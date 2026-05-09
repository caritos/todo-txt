import { describe, it, expect, afterEach } from '@jest/globals';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readTasks, writeTasks, resolveFile } from '../src/store';

const TMP = join(tmpdir(), `todo-store-test-${process.pid}.txt`);

afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

describe('resolveFile', () => {
  it('prefers --file flag over env var', () => {
    process.env.TODO_FILE = '/env/todo.txt';
    expect(resolveFile('/flag/todo.txt')).toBe('/flag/todo.txt');
    delete process.env.TODO_FILE;
  });

  it('uses TODO_FILE env var when no flag', () => {
    process.env.TODO_FILE = '/env/todo.txt';
    expect(resolveFile()).toBe('/env/todo.txt');
    delete process.env.TODO_FILE;
  });

  it('falls back to ./todo.txt in cwd', () => {
    delete process.env.TODO_FILE;
    expect(resolveFile()).toMatch(/todo\.txt$/);
  });
});

describe('readTasks', () => {
  it('returns empty array for non-existent file', () => {
    expect(readTasks('/nonexistent/path/todo.txt')).toEqual([]);
  });

  it('reads and parses tasks, assigning 1-based line numbers', () => {
    writeFileSync(TMP, '(A) Fix bug\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.priority).toBe('A');
    expect(tasks[0]!.line).toBe(1);
    expect(tasks[1]!.text).toBe('Buy groceries');
    expect(tasks[1]!.line).toBe(2);
  });

  it('skips empty lines', () => {
    writeFileSync(TMP, '(A) Fix bug\n\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    expect(tasks).toHaveLength(2);
  });
});

describe('writeTasks', () => {
  it('writes tasks back preserving content', () => {
    writeFileSync(TMP, '(A) Fix bug\nBuy groceries\n', 'utf8');
    const tasks = readTasks(TMP);
    writeTasks(TMP, tasks);
    const tasks2 = readTasks(TMP);
    expect(tasks2).toHaveLength(2);
    expect(tasks2[0]!.text).toBe('Fix bug');
    expect(tasks2[1]!.text).toBe('Buy groceries');
  });

  it('parse → write → parse produces identical raw lines', () => {
    const content = [
      '(A) 2026-05-01 Fix login bug +backend @work due:2026-05-10',
      'x 2026-05-04 2026-05-01 Deploy server +backend @work',
      'Buy groceries @personal',
    ].join('\n') + '\n';
    writeFileSync(TMP, content, 'utf8');
    const before = readTasks(TMP);
    writeTasks(TMP, before);
    const after = readTasks(TMP);
    expect(after.map(t => t.raw)).toEqual(before.map(t => t.raw));
  });
});
