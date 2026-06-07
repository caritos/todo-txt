import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './console/index.ts';

function run(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

describe('event command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('creates todo.txt if it does not exist', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    expect(existsSync(todoFile)).toBe(true);
  });

  test('appends event with start:today, end:today, and type:event', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2} Team standup start:\d{4}-\d{2}-\d{2} end:\d{4}-\d{2}-\d{2} type:event\n$/);
  });

  test('prints confirmation with event text', () => {
    const { stdout, code } = run(['--file', todoFile, 'event', 'Team standup']);
    expect(code).toBe(0);
    expect(stdout).toContain('Added:');
    expect(stdout).toContain('Team standup');
  });

  test('exits with error if no text given', () => {
    const { stderr, code } = run(['--file', todoFile, 'event']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('handles multi-word event text', () => {
    run(['--file', todoFile, 'event', 'Weekly team sync +work @office']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('+work');
    expect(content).toContain('@office');
    expect(content).toContain('type:event');
  });

  test('type:event is filterable via list command', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    run(['--file', todoFile, 'add', 'Buy milk']);
    const { stdout } = run(['--file', todoFile, 'list', 'type:event']);
    expect(stdout).toContain('Team standup');
    expect(stdout).not.toContain('Buy milk');
  });

  test('deduplicates type:event if user includes it in text', () => {
    run(['--file', todoFile, 'event', 'Standup type:event']);
    const content = readFileSync(todoFile, 'utf8');
    const matches = content.match(/type:event/g);
    expect(matches).toHaveLength(1);
  });

  test('writes timed event with start: and end:', () => {
    run(['--file', todoFile, 'event', 'Standup start:2026-05-10T09:00 end:2026-05-10T09:30']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10T09:00');
    expect(content).toContain('end:2026-05-10T09:30');
    expect(content).toContain('type:event');
  });

  test('auto-injects end: equal to start: when start: present but end: absent', () => {
    run(['--file', todoFile, 'event', 'Birthday party start:2026-05-10']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2026-05-10');
    expect(content).toContain('end:2026-05-10');
    expect(content).toContain('type:event');
  });

  test('does not inject end: when both start: and end: are given', () => {
    run(['--file', todoFile, 'event', 'Conference start:2026-05-10 end:2026-05-12']);
    const content = readFileSync(todoFile, 'utf8');
    const matches = content.match(/end:/g);
    expect(matches).toHaveLength(1);
    expect(content).toContain('end:2026-05-12');
  });

  test('injects start:today and end:today when no start: given', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:');
    expect(content).toContain('end:');
  });

  test('exits with error for invalid start: format', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Meeting start:05/10/2026']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid start");
  });

  test('exits with error for invalid end: format', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Meeting start:2026-05-10 end:9am']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid end");
  });

  test('accepts all-day event with date-only start: and end:', () => {
    const { code } = run(['--file', todoFile, 'event', 'Holiday start:2026-05-10 end:2026-05-12']);
    expect(code).toBe(0);
  });

  test('accepts timed event with datetime start: and end:', () => {
    const { code } = run(['--file', todoFile, 'event', 'Meeting start:2026-05-10T09:00 end:2026-05-10T10:00']);
    expect(code).toBe(0);
  });

  test('accepts valid frequency extensions', () => {
    const { code } = run(['--file', todoFile, 'event', 'Standup start:2026-05-10T09:00 frequency:weekly frequency-day:M,W,F']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('frequency:weekly');
    expect(content).toContain('frequency-day:M,W,F');
  });

  test('exits with error for invalid frequency: value', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'Task frequency:hourly']);
    expect(code).toBe(1);
    expect(stderr).toContain("invalid frequency");
  });

  test('writes anniversary with type:anniversary when specified', () => {
    run(['--file', todoFile, 'event', 'Augusto Anniversary start:1984-05-06 frequency:yearly type:anniversary']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:anniversary');
    expect(content).not.toContain('type:event');
  });

  test('writes birthday with type:birthday when specified', () => {
    run(['--file', todoFile, 'event', "John's Birthday start:1990-03-15 frequency:yearly type:birthday"]);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:birthday');
    expect(content).not.toContain('type:event');
  });

  test('exits with error for type:anniversary without start:', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', 'My Anniversary type:anniversary']);
    expect(code).toBe(1);
    expect(stderr).toContain('requires a start:');
  });

  test('exits with error for type:birthday without start:', () => {
    const { stderr, code } = run(['--file', todoFile, 'event', "John's Birthday type:birthday"]);
    expect(code).toBe(1);
    expect(stderr).toContain('requires a start:');
  });

  test('plain event still writes type:event not type:anniversary or type:birthday', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('type:event');
    expect(content).not.toContain('type:anniversary');
    expect(content).not.toContain('type:birthday');
  });
});
