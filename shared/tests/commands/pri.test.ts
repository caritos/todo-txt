import { describe, test, expect } from 'bun:test';
import { applyPri, applyDepri } from '../../commands/pri';
import { parseLine } from '../../parser';

describe('applyPri', () => {
  test('sets priority on a task', () => {
    const tasks = [parseLine('call dentist', 1)];
    const { updated } = applyPri(tasks, 1, 'A');
    expect(updated.priority).toBe('A');
    expect(updated.raw.startsWith('(A)')).toBe(true);
  });

  test('throws for unknown task', () => {
    expect(() => applyPri([], 99, 'A')).toThrow('no task #99');
  });

  test('throws for completed task', () => {
    const tasks = [parseLine('x 2026-05-22 done', 1)];
    expect(() => applyPri(tasks, 1, 'A')).toThrow('cannot set priority on completed task #1');
  });
});

describe('applyDepri', () => {
  test('removes priority from a task', () => {
    const tasks = [parseLine('(B) call dentist', 1)];
    const { updated } = applyDepri(tasks, 1);
    expect(updated.priority).toBeUndefined();
  });

  test('throws when task has no priority', () => {
    const tasks = [parseLine('call dentist', 1)];
    expect(() => applyDepri(tasks, 1)).toThrow('no priority');
  });
});
