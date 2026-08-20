import { describe, test, expect, jest } from '@jest/globals';
import { commitVoiceTranscript, undoVoiceTask } from '../hooks/voiceAddCommit';
import type { Task } from '@shared/parser';

const TODAY = '2026-08-01';

describe('commitVoiceTranscript', () => {
  test('appends a parsed task and saves the result', async () => {
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});
    const task = await commitVoiceTranscript([], 'buy milk', TODAY, save);

    expect(task).not.toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]![0];
    expect(saved).toHaveLength(1);
    expect(saved[0]!.text).toBe('buy milk');
  });

  test('returns null and does not save for a blank transcript', async () => {
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});
    const task = await commitVoiceTranscript([], '   ', TODAY, save);

    expect(task).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
});

describe('undoVoiceTask', () => {
  test('removes the matching task by raw and saves', async () => {
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});
    const tasks: Task[] = [
      { line: 1, raw: '2026-08-01 keep this', done: false, text: 'keep this', projects: [], contexts: [], extensions: {} },
      { line: 2, raw: '2026-08-01 buy milk', done: false, text: 'buy milk', projects: [], contexts: [], extensions: {} },
    ];

    await undoVoiceTask(tasks, '2026-08-01 buy milk', save);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]![0];
    expect(saved).toHaveLength(1);
    expect(saved[0]!.raw).toBe('2026-08-01 keep this');
  });

  test('does nothing when the task is no longer present', async () => {
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});
    await undoVoiceTask([], '2026-08-01 buy milk', save);
    expect(save).not.toHaveBeenCalled();
  });
});
