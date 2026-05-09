import { test, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', code: result.status ?? 0 };
}

// Use a fixed date-stamped fixture so counts are predictable
// Today's completionDate doesn't matter — we check section presence not exact counts
const FIXTURE = `(A) 2026-05-01 Fix login bug +backend @work due:2026-05-03
(B) 2026-05-04 Write release notes +docs @work
2026-05-04 Buy groceries @personal
x 2026-05-04 2026-05-01 Deploy staging server +backend @work
x 2026-05-03 2026-05-02 Update dependencies +backend
`;

describe('report command', () => {
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

  test('shows Tasks section with counts', () => {
    const { stdout, code } = run(['--file', todoFile, 'report']);
    expect(code).toBe(0);
    expect(stdout).toContain('Tasks');
    expect(stdout).toContain('Total');
    expect(stdout).toContain('Open');
    expect(stdout).toContain('Done');
  });

  test('shows correct total count', () => {
    const { stdout } = run(['--file', todoFile, 'report']);
    expect(stdout).toContain('Total      5');
  });

  test('shows By Project section', () => {
    const { stdout } = run(['--file', todoFile, 'report']);
    expect(stdout).toContain('By Project');
    expect(stdout).toContain('+backend');
    expect(stdout).toContain('+docs');
  });

  test('shows By Context section', () => {
    const { stdout } = run(['--file', todoFile, 'report']);
    expect(stdout).toContain('By Context');
    expect(stdout).toContain('@work');
    expect(stdout).toContain('@personal');
  });

  test('shows Completed section when done tasks exist', () => {
    const { stdout } = run(['--file', todoFile, 'report']);
    expect(stdout).toContain('Completed');
    expect(stdout).toContain('Today');
    expect(stdout).toContain('This week');
  });

  test('no Completed section when no done tasks', () => {
    const onlyOpen = `(A) 2026-05-01 Fix login bug +backend
2026-05-04 Buy groceries
`;
    writeFileSync(todoFile, onlyOpen, 'utf8');
    const { stdout } = run(['--file', todoFile, 'report']);
    expect(stdout).not.toContain('Completed');
  });

  test('exits with error if file not found', () => {
    const { stderr, code } = run(['--file', '/nonexistent/todo.txt', 'report']);
    expect(code).toBe(1);
    expect(stderr).toContain('No todo.txt found');
  });
});
