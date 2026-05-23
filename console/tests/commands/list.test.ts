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

const JSON_FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work due:2026-05-15
(B) 2026-05-04 Write release notes +docs @work due:2026-05-20
2026-05-04 Buy groceries @personal
x 2026-05-07 2026-05-01 Deploy staging server +backend @work
x 2026-05-09 2026-05-05 Write docs +docs @work
`;

describe('list --json', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-json-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json returns valid JSON array', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(Array.isArray(tasks)).toBe(true);
  });

  test('--json standalone returns only open tasks', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { done: boolean }) => !t.done)).toBe(true);
    expect(tasks.length).toBe(3);
  });

  test('--json output has correct shape with null for absent fields', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    const grocery = tasks.find((t: { description: string }) => t.description === 'Buy groceries @personal');
    expect(grocery).toBeDefined();
    expect(grocery.done).toBe(false);
    expect(grocery.completionDate).toBeNull();
    expect(grocery.creationDate).toBe('2026-05-04');
    expect(grocery.priority).toBeNull();
    expect(grocery.projects).toEqual([]);
    expect(grocery.contexts).toEqual(['@personal']);
    expect(grocery.extensions).toEqual({});
  });

  test('--json output strips extensions from description', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    const tasks = JSON.parse(stdout);
    const bug = tasks.find((t: { description: string }) => t.description.includes('Fix login bug'));
    expect(bug.text).toContain('due:2026-05-15');
    expect(bug.description).not.toContain('due:');
  });

  test('--json does not print summary line', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json']);
    expect(stdout).not.toContain('open');
  });

  test('without --json, list still works as before', () => {
    const { stdout } = run(['--file', todoFile, 'list']);
    expect(() => JSON.parse(stdout)).toThrow();
    expect(stdout).toContain('open');
  });
});

describe('list --json --done', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-done-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json --done returns only completed tasks', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json', '--done']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { done: boolean }) => t.done)).toBe(true);
    expect(tasks.length).toBe(2);
  });

  test('--json --done --from filters by completionDate lower bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-05-09']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].completionDate).toBe('2026-05-09');
  });

  test('--json --done --to filters by completionDate upper bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--to', '2026-05-07']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].completionDate).toBe('2026-05-07');
  });

  test('--json --done --from --to returns tasks in range (inclusive)', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-05-07', '--to', '2026-05-09']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(2);
  });

  test('--json --done --from --to returns empty array when no match', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--from', '2026-06-01', '--to', '2026-06-30']);
    const tasks = JSON.parse(stdout);
    expect(tasks).toEqual([]);
  });

  test('--done ignores --due-from (silently)', () => {
    const withDueFrom = run(['--file', todoFile, 'list', '--json', '--done', '--due-from', '2099-01-01']).stdout;
    const withoutDueFrom = run(['--file', todoFile, 'list', '--json', '--done']).stdout;
    expect(JSON.parse(withDueFrom)).toEqual(JSON.parse(withoutDueFrom));
  });

  test('--done takes precedence over --pending', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--done', '--pending']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { done: boolean }) => t.done)).toBe(true);
  });
});

describe('list --json --pending due-date filters', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-due-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json --due-from filters pending tasks by due: lower bound', () => {
    const { stdout, code } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-18']);
    expect(code).toBe(0);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].extensions.due).toBe('2026-05-20');
  });

  test('--json --due-to filters pending tasks by due: upper bound', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-to', '2026-05-15']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].extensions.due).toBe('2026-05-15');
  });

  test('--json --due-from --due-to returns tasks in range (inclusive)', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-15', '--due-to', '2026-05-20']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(2);
  });

  test('--pending flag is a no-op (same as default)', () => {
    const withPending = run(['--file', todoFile, 'list', '--json', '--pending']).stdout;
    const withoutPending = run(['--file', todoFile, 'list', '--json']).stdout;
    expect(JSON.parse(withPending)).toEqual(JSON.parse(withoutPending));
  });

  test('tasks without due: are excluded when --due-from is provided', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-05-01']);
    const tasks = JSON.parse(stdout);
    const noDue = tasks.filter((t: { extensions: Record<string, string> }) => !t.extensions['due']);
    expect(noDue.length).toBe(0);
  });

  test('--json --due-from --due-to returns empty array when no match', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '--due-from', '2026-06-01', '--due-to', '2026-06-30']);
    const tasks = JSON.parse(stdout);
    expect(tasks).toEqual([]);
  });
});

describe('list --json with existing filters', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-jfilter-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, JSON_FIXTURE, 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('--json +project filters to matching tasks only', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '+backend']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { projects: string[] }) => t.projects.includes('+backend'))).toBe(true);
    expect(tasks.length).toBe(1);
  });

  test('--json @context filters to matching tasks only', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', '@personal']);
    const tasks = JSON.parse(stdout);
    expect(tasks.every((t: { contexts: string[] }) => t.contexts.includes('@personal'))).toBe(true);
    expect(tasks.length).toBe(1);
  });

  test('--json keyword filter is case-insensitive', () => {
    const { stdout } = run(['--file', todoFile, 'list', '--json', 'LOGIN']);
    const tasks = JSON.parse(stdout);
    expect(tasks.length).toBe(1);
    expect(tasks[0].description).toContain('Fix login bug');
  });
});
