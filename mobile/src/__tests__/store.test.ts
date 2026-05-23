import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  moveAsync: jest.fn(),
}));

jest.mock('@shared/parser', () => ({
  parseLine: jest.fn((line: string, i: number) => ({
    line: i,
    raw: line,
    done: false,
    text: line,
    projects: [],
    contexts: [],
    extensions: {},
  })),
}));

import * as FileSystem from 'expo-file-system';
import { readTasks, writeTasks, resolveFile, setFilePath } from '../store';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => jest.clearAllMocks());

describe('resolveFile', () => {
  test('returns default path when config does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const path = await resolveFile();
    expect(path).toBe('file:///mock-doc-dir/todo.txt');
  });

  test('returns stored path from config', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce(
      JSON.stringify({ filePath: 'file:///mock-doc-dir/icloud/todo.txt' })
    );
    const path = await resolveFile();
    expect(path).toBe('file:///mock-doc-dir/icloud/todo.txt');
  });
});

describe('readTasks', () => {
  test('returns empty array when file does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toEqual([]);
  });

  test('parses non-empty lines and skips blank lines', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce('task one\n\ntask two\n');
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toHaveLength(2);
  });
});

describe('writeTasks', () => {
  test('writes tasks as newline-joined raw strings via tmp+rename', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    mockFs.moveAsync.mockResolvedValueOnce(undefined as any);

    const tasks = [
      { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
      { line: 2, raw: 'task two', done: false, text: 'task two', projects: [], contexts: [], extensions: {} },
    ] as any;

    await writeTasks('file:///mock-doc-dir/todo.txt', tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo.txt.tmp',
      'task one\ntask two\n',
      { encoding: 'utf8' }
    );
    expect(mockFs.moveAsync).toHaveBeenCalledWith({
      from: 'file:///mock-doc-dir/todo.txt.tmp',
      to: 'file:///mock-doc-dir/todo.txt',
    });
  });
});

describe('setFilePath', () => {
  test('writes config file with new path', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    await setFilePath('file:///icloud/todo.txt');
    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo-config.json',
      JSON.stringify({ filePath: 'file:///icloud/todo.txt' }),
      { encoding: 'utf8' }
    );
  });
});
