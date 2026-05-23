import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI = './src/index.ts';

function run(args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('done command - recurring tasks', () => {
  let dir: string;
  let todoFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'todo-recurring-'));
    todoFile = join(dir, 'todo.txt');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test('creates completed copy and updates last-done on original', () => {
    const today = todayStr();
    writeFileSync(todoFile, `stoicism start:${daysAgo(1)}T06:00 frequency:daily\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Done:');
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    // completed copy: plain done line, no start/frequency
    const copy = lines.find(l => l.startsWith('x ') && l.includes('stoicism') && !l.includes('frequency:'));
    expect(copy).toBeDefined();
    expect(copy).toContain(today);
    // original stays open with last-done
    const original = lines.find(l => l.includes('frequency:daily'));
    expect(original).toBeDefined();
    expect(original).not.toMatch(/^x /);
    expect(original).toContain(`last-done:${today}`);
  });

  test('rejects with "Already completed today" if last-done equals today', () => {
    const today = todayStr();
    writeFileSync(todoFile, `stoicism start:2026-05-07T06:00 frequency:daily last-done:${today}\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Already completed today');
  });

  test('migrates old done:true recurring task: resets to open, creates copy, sets last-done', () => {
    const today = todayStr();
    const yesterday = daysAgo(1);
    writeFileSync(todoFile, `x ${yesterday} stoicism start:2026-05-07T06:00 frequency:daily\n`, 'utf8');
    const { code } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    const content = readFileSync(todoFile, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    // completed copy added
    const copy = lines.find(l => l.startsWith('x ') && l.includes('stoicism') && !l.includes('frequency:'));
    expect(copy).toBeDefined();
    // original reset to open
    const original = lines.find(l => l.includes('frequency:daily'));
    expect(original).not.toMatch(/^x /);
    expect(original).toContain(`last-done:${today}`);
  });

  test('rejects old done:true recurring task if completionDate is today', () => {
    const today = todayStr();
    writeFileSync(todoFile, `x ${today} stoicism start:2026-05-07T06:00 frequency:daily\n`, 'utf8');
    const { code, stdout } = run(['--file', todoFile, 'done', '1']);
    expect(code).toBe(0);
    expect(stdout).toContain('Already completed today');
  });

  test('preserves +project and @context in completed copy', () => {
    const today = todayStr();
    writeFileSync(todoFile, `morning reflection +family start:${daysAgo(1)}T06:00 frequency:daily\n`, 'utf8');
    run(['--file', todoFile, 'done', '1']);
    const content = readFileSync(todoFile, 'utf8');
    const copy = content.split('\n').find(l => l.startsWith('x ') && !l.includes('frequency:'));
    expect(copy).toContain('+family');
    expect(copy).not.toContain('start:');
    expect(copy).not.toContain('frequency:');
  });

  test('weekly recurring task advances start to next occurrence on completion', () => {
    const today = todayStr();
    const tomorrow = daysAgo(-1);
    const nextWeek = daysAgo(-8);  // tomorrow + 7
    writeFileSync(todoFile, `mow lawn start:${tomorrow}T09:00 frequency:weekly\n`, 'utf8');
    run(['--file', todoFile, 'done', '1']);
    const content = readFileSync(todoFile, 'utf8');
    const original = content.split('\n').find(l => l.includes('frequency:weekly'));
    expect(original).toBeDefined();
    expect(original).toContain(`start:${nextWeek}T09:00`);
    expect(original).toContain(`last-done:${today}`);
  });

  test('daily recurring task does not advance start on completion', () => {
    const today = todayStr();
    const yesterday = daysAgo(1);
    writeFileSync(todoFile, `stoicism start:${yesterday}T06:00 frequency:daily\n`, 'utf8');
    run(['--file', todoFile, 'done', '1']);
    const content = readFileSync(todoFile, 'utf8');
    const original = content.split('\n').find(l => l.includes('frequency:daily'));
    expect(original).toBeDefined();
    expect(original).toContain(`start:${yesterday}T06:00`);
    expect(original).toContain(`last-done:${today}`);
  });

  test('completes only once when same recurring task number given twice', () => {
    writeFileSync(todoFile, `stoicism start:${daysAgo(1)}T06:00 frequency:daily\n`, 'utf8');
    const { stdout } = run(['--file', todoFile, 'done', '1', '1']);
    expect(stdout).toContain('Done:');
    expect(stdout).toContain('Already completed today');
    const content = readFileSync(todoFile, 'utf8');
    const copies = content.split('\n').filter(l => l.startsWith('x ') && l.includes('stoicism') && !l.includes('frequency:'));
    expect(copies).toHaveLength(1);
  });
});
