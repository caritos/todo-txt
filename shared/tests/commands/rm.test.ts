import { describe, test, expect } from 'bun:test';
import { applyRm } from '../../commands/rm';
import { parseLine } from '../../parser';

describe('applyRm', () => {
  test('removes a single task', () => {
    const tasks = [parseLine('task one', 1), parseLine('task two', 2)];
    const { tasks: updated, removed, missing } = applyRm(tasks, [1]);
    expect(updated).toHaveLength(1);
    expect(removed).toEqual(['task one']);
    expect(missing).toHaveLength(0);
  });

  test('removes multiple tasks and re-indexes', () => {
    const tasks = [parseLine('a', 1), parseLine('b', 2), parseLine('c', 3)];
    const { tasks: updated } = applyRm(tasks, [1, 2]);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.line).toBe(1);
  });

  test('collects missing line numbers', () => {
    const tasks = [parseLine('task one', 1)];
    const { missing, removed } = applyRm(tasks, [99]);
    expect(missing).toEqual([99]);
    expect(removed).toHaveLength(0);
  });
});
