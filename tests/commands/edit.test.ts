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

describe('edit command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
    writeFileSync(todoFile, [
      '2026-05-06 Wedding Anniversary start:2019-05-01 frequency:yearly type:anniversary',
      '(B) 2026-05-01 Write release notes +docs',
      '2026-05-04 Buy groceries',
    ].join('\n') + '\n', 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('replaces task text and preserves creation date', () => {
    const { code } = run(['--file', todoFile, 'edit', '1',
      'Wedding Anniversary start:2004-05-01 frequency:yearly type:anniversary']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('start:2004-05-01');
    expect(content).not.toContain('start:2019-05-01');
    expect(content).toContain('2026-05-06'); // original creation date preserved
  });

  test('prints confirmation with updated task', () => {
    const { stdout } = run(['--file', todoFile, 'edit', '1',
      'Wedding Anniversary start:2004-05-01 frequency:yearly type:anniversary']);
    expect(stdout).toContain('Updated:');
    expect(stdout).toContain('Wedding Anniversary');
  });

  test('can add a priority via edit', () => {
    run(['--file', todoFile, 'edit', '3', '(A) Buy groceries urgently']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('(A)');
    expect(content).toContain('Buy groceries urgently');
  });

  test('can remove a priority via edit', () => {
    run(['--file', todoFile, 'edit', '2', 'Write release notes +docs']);
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    // line 2 should no longer have (B)
    expect(lines[1]).not.toContain('(B)');
    expect(lines[1]).toContain('Write release notes');
  });

  test('other tasks are untouched', () => {
    run(['--file', todoFile, 'edit', '1',
      'Wedding Anniversary start:2004-05-01 frequency:yearly type:anniversary']);
    const content = readFileSync(todoFile, 'utf8');
    expect(content).toContain('Write release notes');
    expect(content).toContain('Buy groceries');
  });

  test('exits with error for invalid task number', () => {
    const { stderr, code } = run(['--file', todoFile, 'edit', '99', 'new text']);
    expect(code).toBe(1);
    expect(stderr).toContain('no task #99');
  });

  test('exits with error for non-numeric argument', () => {
    const { stderr, code } = run(['--file', todoFile, 'edit', 'abc', 'new text']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if no arguments given', () => {
    const { stderr, code } = run(['--file', todoFile, 'edit']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if no new text given', () => {
    const { stderr, code } = run(['--file', todoFile, 'edit', '1']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error when editing a completed task', () => {
    writeFileSync(todoFile, 'x 2026-05-05 2026-05-01 Already done\n', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'edit', '1', 'new text']);
    expect(code).toBe(1);
    expect(stderr).toContain('cannot edit');
  });

  test('rejects invalid frequency extension in new text', () => {
    const { stderr, code } = run(['--file', todoFile, 'edit', '1',
      'Some task frequency:invalid']);
    expect(code).toBe(1);
    expect(stderr).toContain('invalid');
  });
});
