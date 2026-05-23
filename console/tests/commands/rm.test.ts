import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './console/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend
`;

describe('rm command', () => {
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

  test('removes task from file', () => {
    const { code } = run(['--file', todoFile, 'rm', '2']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).not.toContain('Buy groceries');
    expect(content).toContain('Fix login bug'); // other tasks stay
  });

  test('prints confirmation with deleted task text', () => {
    const { stdout } = run(['--file', todoFile, 'rm', '1']);
    expect(stdout).toContain('Deleted:');
    expect(stdout).toContain('Fix login bug');
  });

  test('exits with error for invalid task number', () => {
    const { stderr, code } = run(['--file', todoFile, 'rm', '99']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });

  test('exits with error for non-numeric argument', () => {
    const { stderr, code } = run(['--file', todoFile, 'rm', 'abc']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if no argument given', () => {
    const { stderr, code } = run(['--file', todoFile, 'rm']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('remaining tasks stay intact', () => {
    run(['--file', todoFile, 'rm', '2']);
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2); // 3 tasks - 1 deleted = 2
  });
});
