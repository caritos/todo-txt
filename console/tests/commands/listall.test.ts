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

const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work due:2026-05-03
(B) 2026-05-04 Write release notes +docs @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend @work
x 2026-05-03 2026-05-02 Update dependencies +backend
`;

describe('listall command', () => {
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

  test('lists open and completed tasks', () => {
    const { stdout, code } = run(['--file', todoFile, 'listall']);
    expect(code).toBe(0);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Deploy staging server'); // done task visible
    expect(stdout).toContain('Update dependencies');   // done task visible
  });

  test('summary shows total, open, completed', () => {
    const { stdout } = run(['--file', todoFile, 'listall']);
    expect(stdout).toContain('total');
    expect(stdout).toContain('open');
    expect(stdout).toContain('completed');
  });

  test('filters work on all tasks', () => {
    const { stdout } = run(['--file', todoFile, 'listall', '+backend']);
    expect(stdout).toContain('Fix login bug');
    expect(stdout).toContain('Deploy staging server'); // done +backend task
    expect(stdout).not.toContain('Write release notes'); // +docs not +backend
    expect(stdout).not.toContain('Buy groceries'); // no project
  });

  test('exits with error if file not found', () => {
    const { stderr, code } = run(['--file', '/nonexistent/todo.txt', 'listall']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt found');
  });
});
