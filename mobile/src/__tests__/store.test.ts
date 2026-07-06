import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
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
  serializeTasks: jest.fn((tasks: Array<{ raw: string }>) =>
    tasks.map(t => t.raw).join('\n') + '\n'
  ),
}));

import * as FileSystem from 'expo-file-system';
import { readTasks, writeTasks, resolveFile } from '../store';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => { jest.clearAllMocks(); });

describe('resolveFile', () => {
  test('always returns LOCAL_PATH, without touching persisted config', async () => {
    const path = await resolveFile();
    // There is only one valid storage location now — LOCAL_PATH is computed
    // fresh, never trusted from a persisted absolute path (see store.ts).
    expect(path).toBe('file:///mock-doc-dir/todo.txt');
    expect(mockFs.readAsStringAsync).not.toHaveBeenCalled();
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
  const tasks = [
    { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
    { line: 2, raw: 'task two', done: false, text: 'task two', projects: [], contexts: [], extensions: {} },
  ] as any;

  test('writes tasks directly to file path without tmp', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);

    await writeTasks('file:///mock-doc-dir/todo.txt', tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo.txt',
      'task one\ntask two\n',
      { encoding: 'utf8' }
    );
  });

  test('throws descriptive error when write fails', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockRejectedValueOnce(new Error('NSCocoaErrorDomain 517'));

    await expect(writeTasks('file:///mock-doc-dir/todo.txt', tasks)).rejects.toThrow(
      'Could not write to /mock-doc-dir/todo.txt. Check the file path in Settings.'
    );
  });

  test('throws immediately for empty file path', async () => {
    await expect(writeTasks('', tasks)).rejects.toThrow('File path not configured');
  });
});
