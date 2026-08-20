import { describe, test, expect } from '@jest/globals';
import { transcriptToTask } from '../voiceAdd';
import type { Task } from '@shared/parser';

const TODAY = '2026-05-23';

describe('transcriptToTask', () => {
  test('returns null for an empty transcript', () => {
    expect(transcriptToTask('', [], TODAY)).toBeNull();
  });

  test('returns null for a whitespace-only transcript', () => {
    expect(transcriptToTask('   ', [], TODAY)).toBeNull();
  });

  test('returns null when the transcript is only a date phrase with no title left', () => {
    expect(transcriptToTask('tomorrow', [], TODAY)).toBeNull();
  });

  test('builds a plain task appended at the end of the list', () => {
    const existing: Task[] = [
      { line: 1, raw: '2026-05-20 existing', done: false, text: 'existing', projects: [], contexts: [], extensions: {} },
    ];
    const task = transcriptToTask('call dentist', existing, TODAY);
    expect(task).not.toBeNull();
    expect(task!.line).toBe(2);
    expect(task!.text).toBe('call dentist');
    expect(task!.extensions.start).toBeUndefined();
  });

  test('carries a parsed date into the start: extension', () => {
    const task = transcriptToTask('call dentist tomorrow', [], TODAY);
    expect(task!.extensions.start).toBe('2026-05-24');
  });

  test('carries a parsed priority', () => {
    const task = transcriptToTask('call dentist (A)', [], TODAY);
    expect(task!.priority).toBe('A');
  });
});
