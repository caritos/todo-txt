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

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

describe('focus command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('shows (A) priority tasks', () => {
    writeFileSync(todoFile, [
      `(A) ${TODAY} Urgent fix`,
      `${TODAY} Buy groceries`,
    ].join('\n') + '\n', 'utf8');
    const { stdout, code } = run(['--file', todoFile, 'focus']);
    expect(code).toBe(0);
    expect(stdout).toContain('Urgent fix');
    expect(stdout).not.toContain('Buy groceries');
  });

  test('shows overdue tasks regardless of priority', () => {
    writeFileSync(todoFile, [
      `${TODAY} Pay rent due:${YESTERDAY}`,
      `${TODAY} Buy groceries`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Pay rent');
    expect(stdout).not.toContain('Buy groceries');
  });

  test('shows tasks due today', () => {
    writeFileSync(todoFile, [
      `${TODAY} Submit report due:${TODAY}`,
      `${TODAY} Buy groceries`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('Submit report');
    expect(stdout).not.toContain('Buy groceries');
  });

  test('does not show tasks due in the future', () => {
    writeFileSync(todoFile, [
      `${TODAY} Plan vacation due:${TOMORROW}`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Plan vacation');
  });

  test('does not show completed tasks', () => {
    writeFileSync(todoFile, `x ${TODAY} ${TODAY} Done task due:${YESTERDAY}\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Done task');
  });

  test('does not show past events', () => {
    writeFileSync(todoFile, `${YESTERDAY} Garage sale start:${YESTERDAY}T09:00 end:${YESTERDAY}T10:00 type:event\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).not.toContain('Garage sale');
  });

  test('shows "nothing needs attention" when focus list is empty', () => {
    writeFileSync(todoFile, `${TODAY} Buy groceries\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout).toContain('nothing needs attention');
  });

  test('(A) tasks appear before unprioritized overdue tasks', () => {
    writeFileSync(todoFile, [
      `${TODAY} Overdue chore due:${YESTERDAY}`,
      `(A) ${TODAY} Urgent fix`,
    ].join('\n') + '\n', 'utf8');
    const { stdout } = run(['--file', todoFile, 'focus']);
    expect(stdout.indexOf('Urgent fix')).toBeLessThan(stdout.indexOf('Overdue chore'));
  });

  test('exits with error if file not found', () => {
    const { stderr, code } = run(['--file', '/nonexistent/todo.txt', 'focus']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt found');
  });
});
