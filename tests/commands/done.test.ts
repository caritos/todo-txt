import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
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

describe('done command', () => {
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

  test('marks task as done', () => {
    const { code } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toMatch(/^x \d{4}-\d{2}-\d{2} 2026-05-01 Fix login bug \+backend @work/m);
  });

  test('removes priority on completion', () => {
    run(['--file', todoFile, 'done', '1']);
    const content = readFileSync(todoFile, 'utf8');
    // Should NOT have (A) in the completed line
    const lines = content.split('\n');
    const doneLine = lines.find(l => l.includes('Fix login bug'));
    expect(doneLine).not.toContain('(A)');
  });

  test('prints confirmation', () => {
    const { stdout } = run(['--file', todoFile, 'done', '1']);
    expect(stdout).toContain('Done:');
    expect(stdout).toContain('Fix login bug');
  });

  test('exits with error for invalid task number', () => {
    const { stderr, code } = run(['--file', todoFile, 'done', '99']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });

  test('exits with error for non-numeric argument', () => {
    const { stderr, code } = run(['--file', todoFile, 'done', 'abc']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if no argument given', () => {
    const { stderr, code } = run(['--file', todoFile, 'done']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('handles already-done task gracefully', () => {
    const { stdout, code } = run(['--file', todoFile, 'done', '3']);
    expect(code).toBe(0);
    expect(stdout).toContain('already complete');
  });
});
