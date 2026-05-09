import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work due:2026-05-03
(B) 2026-05-04 Write release notes +docs @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend @work
`;

describe('list command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('lists only open tasks', () => {
    const { stdout, code } = run(['--file', todoFile, 'list']);
    expect(code).toBe(0);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Write release notes');
    expect(stdout).toContain('Buy groceries');
    expect(stdout).not.toContain('Deploy staging server'); // done task
  });

  test('filters by project', () => {
    const { stdout } = run(['--file', todoFile, 'list', '+backend']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Write release notes');
    expect(stdout).not.toContain('Buy groceries');
  });

  test('filters by context', () => {
    const { stdout } = run(['--file', todoFile, 'list', '@personal']);
    expect(stdout).toContain('Buy groceries');
    expect(stdout).not.toContain('Fix login bug');
  });

  test('filters by priority', () => {
    const { stdout } = run(['--file', todoFile, 'list', '(A)']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Write release notes');
  });

  test('filters by keyword (case-insensitive)', () => {
    const { stdout } = run(['--file', todoFile, 'list', 'login']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Write release notes');
  });

  test('multiple filters are ANDed', () => {
    const { stdout } = run(['--file', todoFile, 'list', '+backend', '@work']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Write release notes'); // +docs not +backend
    expect(stdout).not.toContain('Buy groceries'); // @personal not @work
  });

  test('prints summary', () => {
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('open');
  });

  test('exits with error if file not found', () => {
    const { stderr, code } = run(['--file', '/nonexistent/todo.txt', 'list']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt found');
  });

  test('sorts output with (A) before (B) before unprioritized', () => {
    // File order is deliberately reversed to prove sorting
    const fixture = [
      '2026-05-01 Buy groceries',
      '(B) 2026-05-01 Write docs',
      '(A) 2026-05-01 Fix bug',
    ].join('\n') + '\n';
    const { mkdtempSync, rmSync, writeFileSync } = require('fs');
    const { join } = require('path');
    const { tmpdir } = require('os');
    const d = mkdtempSync(join(tmpdir(), 'todo-sort-'));
    const f = join(d, 'todo.txt');
    writeFileSync(f, fixture, 'utf8');
    const { stdout } = run(['--file', f, 'list']);
    rmSync(d, { recursive: true });
    expect(stdout.indexOf('Fix bug')).toBeLessThan(stdout.indexOf('Write docs'));
    expect(stdout.indexOf('Write docs')).toBeLessThan(stdout.indexOf('Buy groceries'));
  });
});

describe('list command — year count display', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('shows (N years) for type:anniversary with start:', () => {
    const startYear = 1984;
    const expectedYears = new Date().getFullYear() - startYear;
    writeFileSync(todoFile, `2026-05-06 Augusto Anniversary start:${startYear}-05-06 frequency:yearly type:anniversary\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain(`(${expectedYears} years)`);
  });

  test('shows (N years) for type:birthday with start:', () => {
    const startYear = 1990;
    const expectedYears = new Date().getFullYear() - startYear;
    writeFileSync(todoFile, `2026-05-06 John Birthday start:${startYear}-03-15 frequency:yearly type:birthday\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain(`(${expectedYears} years)`);
  });

  test('does not show (N years) for type:event', () => {
    writeFileSync(todoFile, `2026-05-06 Team standup start:2024-05-06 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).not.toContain('years)');
  });

  test('does not show (N years) for anniversary without start:', () => {
    writeFileSync(todoFile, `2026-05-06 My Anniversary type:anniversary\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).not.toContain('years)');
  });
});

describe('list command — past event filtering', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('shows non-recurring event with past start:', () => {
    writeFileSync(todoFile, `2026-05-06 Tag Sale start:2026-04-24T09:30 end:2026-04-24T10:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Tag Sale');
  });

  test('shows recurring event with past start:', () => {
    writeFileSync(todoFile, `2026-05-06 Weekly Standup start:2026-04-01T09:00 frequency:weekly type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Weekly Standup');
  });

  test('shows event with future start:', () => {
    writeFileSync(todoFile, `2026-05-06 Summer Party start:2026-07-04T14:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Summer Party');
  });

  test('shows event starting today:', () => {
    writeFileSync(todoFile, `2026-05-06 Morning Meeting start:2026-05-06T09:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Morning Meeting');
  });

  test('regular task without type: is not hidden by past start:', () => {
    writeFileSync(todoFile, `2026-05-06 Old task start:2026-04-01\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Old task');
  });

  test('shows recurring event with past recur-until:', () => {
    writeFileSync(todoFile, `2026-05-06 Tennis start:2023-03-07T20:00 frequency:weekly recur-until:2023-06-05 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Tennis');
  });

  test('shows recurring event with future recur-until:', () => {
    writeFileSync(todoFile, `2026-05-06 Tennis start:2026-04-01T20:00 frequency:weekly recur-until:2026-12-31 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Tennis');
  });

  test('shows recurring event with no recur-until:', () => {
    writeFileSync(todoFile, `2026-05-06 Weekly Standup start:2023-01-01T09:00 frequency:weekly type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(stdout).toContain('Weekly Standup');
  });
});
