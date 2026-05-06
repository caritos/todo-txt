import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
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

describe('import command', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-test-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('exits with error if no ics file argument given', () => {
    const { stderr, code } = run(['--file', todoFile, 'import']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  test('exits with error if ics file does not exist', () => {
    const { stderr, code } = run(['--file', todoFile, 'import', '/nonexistent/path.ics']);
    expect(code).toBe(1);
    expect(stderr).toContain('No such file');
  });

  test('exits with error if file is not valid ICS', () => {
    const badPath = join(dir, 'bad.ics');
    writeFileSync(badPath, 'this is not ics content', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', badPath]);
    expect(code).toBe(1);
    expect(stderr).toContain('does not appear to be a valid ICS file');
  });

  test('exits with error if ICS file has no VEVENT components', () => {
    const emptyIcs = join(dir, 'empty.ics');
    writeFileSync(emptyIcs, 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//Test//EN\r\nEND:VCALENDAR\r\n', 'utf8');
    const { stderr, code } = run(['--file', todoFile, 'import', emptyIcs]);
    expect(code).toBe(1);
    expect(stderr).toContain('no events found');
  });
});
