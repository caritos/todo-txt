import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  cacheDirectory: 'file:///mock-cache-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  NativeModules: {
    ExpoIcloudFile: {
      pickFolder: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  },
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
import { NativeModules } from 'react-native';
import {
  readTasks,
  writeTasks,
  resolveFile,
  resolveStorageInfo,
  enableICloudStorage,
  disableICloudStorage,
} from '../store';

const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockIcloud = NativeModules.ExpoIcloudFile as jest.Mocked<typeof NativeModules.ExpoIcloudFile>;

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.readAsStringAsync.mockRejectedValue(new Error('no config file'));
});

describe('resolveFile', () => {
  test('returns LOCAL_PATH when no iCloud bookmark is configured', async () => {
    const path = await resolveFile();
    expect(path).toBe('file:///mock-doc-dir/todo.txt');
  });

  test('returns an icloud: prefixed path when a bookmark is configured', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ icloudBookmark: 'abc123', icloudFolderName: 'Stark' }));
    const path = await resolveFile();
    expect(path).toBe('icloud:abc123');
  });
});

describe('resolveStorageInfo', () => {
  test('reports local mode with LOCAL_PATH as the label when unconfigured', async () => {
    const info = await resolveStorageInfo();
    expect(info).toEqual({ mode: 'local', label: 'file:///mock-doc-dir/todo.txt' });
  });

  test('reports icloud mode with the folder name as the label when configured', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ icloudBookmark: 'abc123', icloudFolderName: 'Stark' }));
    const info = await resolveStorageInfo();
    expect(info).toEqual({ mode: 'icloud', label: 'ICLOUD DRIVE — Stark' });
  });
});

describe('readTasks', () => {
  test('returns empty array when local file does not exist', async () => {
    mockFs.readAsStringAsync.mockRejectedValueOnce(new Error('not found'));
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toEqual([]);
  });

  test('parses non-empty lines and skips blank lines for a local path', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce('task one\n\ntask two\n');
    const tasks = await readTasks('file:///mock-doc-dir/todo.txt');
    expect(tasks).toHaveLength(2);
  });

  test('reads via the native module for an icloud: path', async () => {
    mockIcloud.readFile.mockResolvedValueOnce('task one\ntask two\n');
    const tasks = await readTasks('icloud:abc123');
    expect(mockIcloud.readFile).toHaveBeenCalledWith('abc123');
    expect(tasks).toHaveLength(2);
  });

  test('throws when the icloud file does not exist (always an error state — the file is always created during enable, so a missing file means something went wrong on the iCloud side)', async () => {
    const err = Object.assign(new Error('not found'), { code: 'FILE_NOT_FOUND' });
    mockIcloud.readFile.mockRejectedValueOnce(err);
    await expect(readTasks('icloud:abc123')).rejects.toThrow(/Could not access iCloud Drive/);
  });

  test('throws when the icloud bookmark is stale', async () => {
    const err = Object.assign(new Error('stale'), { code: 'BOOKMARK_STALE' });
    mockIcloud.readFile.mockRejectedValueOnce(err);
    await expect(readTasks('icloud:abc123')).rejects.toThrow(/Could not access iCloud Drive/);
  });
});

describe('writeTasks', () => {
  const tasks = [
    { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
    { line: 2, raw: 'task two', done: false, text: 'task two', projects: [], contexts: [], extensions: {} },
  ] as any;

  test('writes tasks directly to a local file path without tmp', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);

    await writeTasks('file:///mock-doc-dir/todo.txt', tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///mock-doc-dir/todo.txt',
      'task one\ntask two\n',
      { encoding: 'utf8' }
    );
  });

  test('throws descriptive error when local write fails', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockRejectedValueOnce(new Error('NSCocoaErrorDomain 517'));

    await expect(writeTasks('file:///mock-doc-dir/todo.txt', tasks)).rejects.toThrow(
      'Could not write to /mock-doc-dir/todo.txt. Check the file path in Settings.'
    );
  });

  test('throws immediately for empty file path', async () => {
    await expect(writeTasks('', tasks)).rejects.toThrow('File path not configured');
  });

  test('writes via the native module for an icloud: path', async () => {
    mockIcloud.writeFile.mockResolvedValueOnce(undefined);
    await writeTasks('icloud:abc123', tasks);
    expect(mockIcloud.writeFile).toHaveBeenCalledWith('abc123', 'task one\ntask two\n');
  });
});

describe('enableICloudStorage', () => {
  const tasks = [
    { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
  ] as any;

  test('writes a temp file, picks a folder, and persists the bookmark', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    mockIcloud.pickFolder.mockResolvedValueOnce({ bookmark: 'abc123', name: 'Stark' });
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any); // config write

    const result = await enableICloudStorage(tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenNthCalledWith(
      1,
      'file:///mock-cache-dir/todo.txt',
      'task one\n',
      { encoding: 'utf8' }
    );
    expect(mockIcloud.pickFolder).toHaveBeenCalledWith('file:///mock-cache-dir/todo.txt');
    expect(mockFs.writeAsStringAsync).toHaveBeenNthCalledWith(
      2,
      'file:///mock-doc-dir/todo-config.json',
      JSON.stringify({ icloudBookmark: 'abc123', icloudFolderName: 'Stark' }),
      { encoding: 'utf8' }
    );
    expect(result).toEqual({ name: 'Stark' });
  });

  test('propagates cancellation without writing config', async () => {
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);
    const err = Object.assign(new Error('cancelled'), { code: 'CANCELLED' });
    mockIcloud.pickFolder.mockRejectedValueOnce(err);

    await expect(enableICloudStorage(tasks)).rejects.toThrow('cancelled');
  });
});

describe('disableICloudStorage', () => {
  const tasks = [
    { line: 1, raw: 'task one', done: false, text: 'task one', projects: [], contexts: [], extensions: {} },
  ] as any;

  test('writes tasks locally and clears the bookmark', async () => {
    mockFs.readAsStringAsync.mockResolvedValueOnce(JSON.stringify({ icloudBookmark: 'abc123', icloudFolderName: 'Stark' }));
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any); // local todo.txt write
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any); // config write

    await disableICloudStorage(tasks);

    expect(mockFs.writeAsStringAsync).toHaveBeenNthCalledWith(
      1,
      'file:///mock-doc-dir/todo.txt',
      'task one\n',
      { encoding: 'utf8' }
    );
    expect(mockFs.writeAsStringAsync).toHaveBeenNthCalledWith(
      2,
      'file:///mock-doc-dir/todo-config.json',
      JSON.stringify({}),
      { encoding: 'utf8' }
    );
  });
});
