import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

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

  test('appends event with type:event extension', () => {
    run(['--file', todoFile, 'event', 'Team standup']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2} Team standup type:event\n$/);
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
});
