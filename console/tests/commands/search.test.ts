import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './console/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend @work
`;

describe('search command', () => {
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

  test('finds open tasks by keyword', () => {
    const { stdout, code } = run(['--file', todoFile, 'search', 'login']);
    expect(code).toBe(0);
    expect(stdout).toContain('Fix login bug');
  });

  test('finds completed tasks too', () => {
    const { stdout } = run(['--file', todoFile, 'search', 'staging']);
    expect(stdout).toContain('Deploy staging server');
  });

  test('search is case-insensitive', () => {
    const { stdout } = run(['--file', todoFile, 'search', 'LOGIN']);
    expect(stdout).toContain('Fix login bug');
  });

  test('shows no results message when nothing matches', () => {
    const { stdout, code } = run(['--file', todoFile, 'search', 'zzznomatch']);
    expect(code).toBe(0);
    expect(stdout).toContain('No tasks matching');
  });

  test('multi-word search works', () => {
    const { stdout } = run(['--file', todoFile, 'search', 'login', 'bug']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).not.toContain('Buy groceries');
  });

  test('exits with error if no search term given', () => {
    const { stderr, code } = run(['--file', todoFile, 'search']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });
});
