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

describe('add command', () => {
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
    run(['--file', todoFile, 'add', 'Buy groceries']);
    expect(existsSync(todoFile)).toBe(true);
  });

  test('appends task with creation date', () => {
    run(['--file', todoFile, 'add', 'Buy groceries']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2} Buy groceries\n$/);
  });

  test('preserves priority when provided', () => {
    run(['--file', todoFile, 'add', '(A) Fix critical bug']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\(A\) \d{4}-\d{2}-\d{2} Fix critical bug\n$/);
  });

  test('prints confirmation with line number', () => {
    const { stdout, code } = run(['--file', todoFile, 'add', 'Buy milk']);
    expect(code).toBe(0);
    expect(stdout).toContain('Added:');
    expect(stdout).toContain('Buy milk');
  });

  test('appends multiple tasks in order', () => {
    run(['--file', todoFile, 'add', 'First task']);
    run(['--file', todoFile, 'add', 'Second task']);
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('First task');
    expect(lines[1]).toContain('Second task');
  });

  test('exits with error if no text given', () => {
    const { stderr, code } = run(['--file', todoFile, 'add']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('handles multi-word text with projects and contexts', () => {
    run(['--file', todoFile, 'add', 'Fix login bug +backend @work due:2026-05-10']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('+backend');
    expect(content).toContain('@work');
    expect(content).toContain('due:2026-05-10');
  });
});
