import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

// store.ts imports expo-icloud unconditionally; these tests only exercise the
// local-file path, so stub it out rather than loading the native react-native module.
jest.mock('expo-icloud', () => ({
  writeICloudFile: jest.fn(),
  readICloudFile: jest.fn(),
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
import { readTasks, writeTasks, resolveFile, setFilePath } from '../store';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => { jest.clearAllMocks(); });

describe('resolveFile', () => {
  test('returns LOCAL_PATH when config does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const path = await resolveFile();
    // Default is LOCAL_PATH = documentDirectory + 'todo.txt'
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
