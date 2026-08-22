import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock only the I/O boundary — shared layer functions are real
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  moveAsync: jest.fn(), // should never be called with the direct-write approach
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

import * as FileSystem from 'expo-file-system';
import { writeTasks } from '../store';
import { applyAdd } from '@shared/commands/add';
import { applyRm } from '@shared/commands/rm';
import type { Task } from '@shared/parser';

const FILE_PATH = 'file:///mock-doc-dir/icloud/todo.txt';
const TODAY = '2026-06-17';
const mockFs = FileSystem as jest.Mocked<typeof FileSystem>;

beforeEach(() => { jest.clearAllMocks(); });

describe('task lifecycle: create then delete', () => {
  test('creates a task and writes it directly to the file (no tmp)', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValueOnce(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValueOnce(undefined as any);

    const { tasks: afterAdd } = applyAdd([], 'Buy milk', TODAY);
    await writeTasks(FILE_PATH, afterAdd);

    // Wrote directly to the target file, not a .tmp intermediary
    expect(mockFs.writeAsStringAsync).toHaveBeenCalledWith(
      FILE_PATH,
      expect.stringContaining('Buy milk'),
      { encoding: 'utf8' },
    );
    expect(mockFs.moveAsync).not.toHaveBeenCalled();

    // Task is present in the returned list
    expect(afterAdd).toHaveLength(1);
    expect(afterAdd[0]!.extensions['start']).toBe(TODAY);
  });

  test('deletes the task and writes an empty file directly (no tmp)', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValue(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValue(undefined as any);

    // Step 1: create
    const { tasks: afterAdd } = applyAdd([], 'Buy milk', TODAY);
    await writeTasks(FILE_PATH, afterAdd);

    // Step 2: delete
    const { tasks: afterDelete } = applyRm([...afterAdd], [afterAdd[0]!.line]);
    await writeTasks(FILE_PATH, afterDelete);

    // After deletion the list is empty and the file gets a bare newline
    expect(afterDelete).toHaveLength(0);
    expect(mockFs.writeAsStringAsync).toHaveBeenLastCalledWith(
      FILE_PATH,
      '\n',
      { encoding: 'utf8' },
    );
    expect(mockFs.moveAsync).not.toHaveBeenCalled();
  });

  test('full round-trip: add two tasks, delete one, verify file content', async () => {
    mockFs.makeDirectoryAsync.mockResolvedValue(undefined as any);
    mockFs.writeAsStringAsync.mockResolvedValue(undefined as any);

    // Add first task
    const { tasks: after1 } = applyAdd([], 'Buy milk', TODAY);
    // Add second task
    const { tasks: after2 } = applyAdd([...after1], 'Call dentist', TODAY);
    await writeTasks(FILE_PATH, after2);

    // Delete the first task (line 1)
    const { tasks: afterDelete } = applyRm([...after2], [1]);
    await writeTasks(FILE_PATH, afterDelete);

    // Only "Call dentist" should remain
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]!.text).toContain('Call dentist');

    // The final write must contain the remaining task and nothing else
    const lastWrite = (mockFs.writeAsStringAsync as jest.MockedFunction<typeof mockFs.writeAsStringAsync>)
      .mock.calls.at(-1)![1] as string;
    expect(lastWrite).toContain('Call dentist');
    expect(lastWrite).not.toContain('Buy milk');
    expect(mockFs.moveAsync).not.toHaveBeenCalled();
  });
});
