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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('focus command', () => {
  let dir: string;
  let todoFile: string;
  let today: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
    today = todayStr();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('exits with error if file not found', () => {
    const { stderr, code } = run(['--file', '/nonexistent/todo.txt', 'focus']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt found');
  });

  test('shows nothing message when no items in window', () => {
    writeFileSync(todoFile, '', 'utf8');
    const { stdout, code } = run(['--file', todoFile, 'focus']);
    expect(code).toBe(0);
    expect(stdout).toContain('Nothing');
  });

  // Non-recurring events
  test('shows non-recurring event with start: in window', () => {
    const start = addDays(today, 5);
    writeFileSync(todoFile, `2026-05-06 Dentist start:${start}T09:00 end:${start}T10:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Dentist');
  });

  test('hides non-recurring event with start: after window', () => {
    const start = addDays(today, 20);
    writeFileSync(todoFile, `2026-05-06 Future Event start:${start} type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Future Event');
  });

  test('hides non-recurring event with start: before today', () => {
    const start = addDays(today, -3);
    writeFileSync(todoFile, `2026-05-06 Past Event start:${start} type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Past Event');
  });

  test('shows non-recurring event starting today', () => {
    writeFileSync(todoFile, `2026-05-06 Today Event start:${today}T10:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Today Event');
  });

  // Yearly recurring (birthday/anniversary)
  test('shows yearly birthday whose next occurrence is in window', () => {
    const nextOccurrence = addDays(today, 7);
    const mmdd = nextOccurrence.slice(5);
    writeFileSync(todoFile, `2026-05-06 John Birthday start:1990-${mmdd} frequency:yearly type:birthday\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('John Birthday');
  });

  test('hides yearly birthday whose next occurrence is after window', () => {
    const afterWindow = addDays(today, 30);
    const mmdd = afterWindow.slice(5);
    writeFileSync(todoFile, `2026-05-06 John Birthday start:1990-${mmdd} frequency:yearly type:birthday\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('John Birthday');
  });

  // Other recurring events (weekly/monthly)
  test('shows active weekly recurring event regardless of original start:', () => {
    const pastStart = addDays(today, -60);
    writeFileSync(todoFile, `2026-05-06 Weekly Standup start:${pastStart}T09:00 frequency:weekly type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Weekly Standup');
  });

  test('hides weekly recurring event whose recur-until: has passed', () => {
    const pastStart = addDays(today, -60);
    const pastUntil = addDays(today, -10);
    writeFileSync(todoFile, `2026-05-06 Ended Standup start:${pastStart}T09:00 frequency:weekly recur-until:${pastUntil} type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Ended Standup');
  });

  // Regular tasks
  test('shows regular task with due: in window', () => {
    const due = addDays(today, 5);
    writeFileSync(todoFile, `2026-05-06 Buy groceries due:${due}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Buy groceries');
  });

  test('hides regular task with due: after window', () => {
    const due = addDays(today, 20);
    writeFileSync(todoFile, `2026-05-06 Future task due:${due}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Future task');
  });

  test('hides regular task with no due:', () => {
    writeFileSync(todoFile, `2026-05-06 No due task\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('No due task');
  });

  test('hides done tasks', () => {
    const due = addDays(today, 5);
    writeFileSync(todoFile, `x 2026-05-06 2026-05-01 Done task due:${due}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Done task');
  });
});
