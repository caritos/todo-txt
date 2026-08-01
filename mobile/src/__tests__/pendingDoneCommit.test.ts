import { describe, test, expect, jest } from '@jest/globals';
import { commitPendingLines } from '../hooks/pendingDoneCommit';
import { applyAdd } from '@shared/commands/add';
import type { Task } from '@shared/parser';

const TODAY = '2026-08-01';

describe('commitPendingLines', () => {
  test('marks the given lines done and saves the result', async () => {
    const { tasks: seeded } = applyAdd([], 'archive important documents', TODAY);
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});

    await commitPendingLines(seeded, [seeded[0]!.line], TODAY, save);

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]![0];
    expect(saved[0]!.done).toBe(true);
  });

  test('does nothing when there are no lines to commit', async () => {
    const { tasks: seeded } = applyAdd([], 'archive important documents', TODAY);
    const save = jest.fn<(updated: Task[]) => Promise<void>>(async () => {});

    await commitPendingLines(seeded, [], TODAY, save);

    expect(save).not.toHaveBeenCalled();
  });
});
