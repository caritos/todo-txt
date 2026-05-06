import { test, expect, describe } from 'bun:test';
import { spawnSync } from 'child_process';

const CLI = './src/index.ts';

function run(...args: string[]): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', [CLI, ...args], { encoding: 'utf8' });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    code: result.status ?? 0,
  };
}

describe('help command', () => {
  test('todo help prints usage', () => {
    const { stdout, code } = run('help');
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: todo <command>');
    expect(stdout).toContain('add <text>');
    expect(stdout).toContain('done <n>');
    expect(stdout).toContain('--file <path>');
  });

  test('todo --help prints usage', () => {
    const { stdout, code } = run('--help');
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: todo <command>');
  });

  test('todo -h prints usage', () => {
    const { stdout, code } = run('-h');
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: todo <command>');
  });

  test('todo with no args prints usage', () => {
    const { stdout, code } = run();
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: todo <command>');
  });

  test('unknown command exits with error', () => {
    const { stderr, code } = run('banana');
    expect(code).toBe(1);
    expect(stderr).toContain("unknown command 'banana'");
  });

  test('documents start: and end: extensions', () => {
    const { stdout } = run('help');
    expect(stdout).toContain('start:');
    expect(stdout).toContain('end:');
  });

  test('documents all frequency extensions', () => {
    const { stdout } = run('help');
    expect(stdout).toContain('frequency:');
    expect(stdout).toContain('every:');
    expect(stdout).toContain('frequency-day:');
    expect(stdout).toContain('frequency-month-day:');
    expect(stdout).toContain('frequency-month:');
  });
});
