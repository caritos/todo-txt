import { describe, test, expect } from 'bun:test';
import { applyEdit } from '../../commands/edit';
import { parseLine } from '../../parser';

describe('applyEdit', () => {
  test('replaces task text and preserves creation date', () => {
    const tasks = [parseLine('2026-01-01 old text', 1)];
    const { updated } = applyEdit(tasks, 1, 'new text', '2026-05-23');
    expect(updated.text).toBe('new text');
    expect(updated.creationDate).toBe('2026-01-01');
  });

  test('throws for unknown line number', () => {
    expect(() => applyEdit([], 99, 'text', '2026-05-23')).toThrow('no task #99');
  });

  test('throws when editing a completed task', () => {
    const tasks = [parseLine('x 2026-05-22 done task', 1)];
    expect(() => applyEdit(tasks, 1, 'new text', '2026-05-23')).toThrow('cannot edit completed task #1');
  });

  test('allows updating priority via edit', () => {
    const tasks = [parseLine('old task', 1)];
    const { updated } = applyEdit(tasks, 1, '(B) new task', '2026-05-23');
    expect(updated.priority).toBe('B');
    expect(updated.text).toBe('new task');
  });
});
