import { test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend
`;

describe('pri command', () => {
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

  test('sets priority on task', () => {
    const { code } = run(['--file', todoFile, 'pri', '2', 'B']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\(B\) 2026-05-04 Buy groceries/m);
  });

  test('replaces existing priority', () => {
    run(['--file', todoFile, 'pri', '1', 'C']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^\(C\)/m);
    expect(content).not.toMatch(/^\(A\)/m);
  });

  test('prints confirmation', () => {
    const { stdout } = run(['--file', todoFile, 'pri', '2', 'B']);
    expect(stdout).toContain('Priority set:');
    expect(stdout).toContain('Buy groceries');
  });

  test('rejects priority on completed task', () => {
    const { stderr, code } = run(['--file', todoFile, 'pri', '3', 'A']);
    expect(code).toBe(1);
    expect(stderr).toContain('completed task');
  });

  test('exits with error for invalid task number', () => {
    const { stderr, code } = run(['--file', todoFile, 'pri', '99', 'A']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });

  test('exits with error if priority is not A-Z', () => {
    const { stderr, code } = run(['--file', todoFile, 'pri', '1', '1']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });
});

describe('depri command', () => {
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

  test('removes priority from task', () => {
    const { code } = run(['--file', todoFile, 'depri', '1']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).not.toContain('(A)');
    expect(content).toContain('Fix login bug');
  });

  test('prints confirmation', () => {
    const { stdout } = run(['--file', todoFile, 'depri', '1']);
    expect(stdout).toContain('Priority removed:');
  });

  test('handles task with no priority gracefully', () => {
    const { stdout, code } = run(['--file', todoFile, 'depri', '2']);
    expect(code).toBe(0);
    expect(stdout).toContain('no priority');
  });

  test('exits with error for invalid task number', () => {
    const { stderr, code } = run(['--file', todoFile, 'depri', '99']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });
});
