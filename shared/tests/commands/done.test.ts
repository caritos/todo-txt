import { describe, test, expect } from 'bun:test';
import { applyDone } from '../../commands/done';
import { parseLine } from '../../parser';

function makeTask(raw: string, line = 1) { return parseLine(raw, line); }

describe('applyDone', () => {
  test('marks a plain task done', () => {
    const tasks = [makeTask('call dentist')];
    const { tasks: updated, completed } = applyDone(tasks, [1], '2026-05-23');
    expect(completed).toHaveLength(1);
    expect(updated[0]!.done).toBe(true);
    expect(updated[0]!.completionDate).toBe('2026-05-23');
  });

  test('throws for unknown line number', () => {
    const tasks = [makeTask('call dentist')];
    expect(() => applyDone(tasks, [99], '2026-05-23')).toThrow('no task #99');
  });

  test('skips already-done task', () => {
    const tasks = [makeTask('x 2026-05-22 call dentist')];
    const { tasks: updated, completed } = applyDone(tasks, [1], '2026-05-23');
    expect(completed).toHaveLength(0);
    expect(updated[0]!.done).toBe(true);
  });

  test('creates recurrence copy for weekly task and advances start one cycle', () => {
    // Task first occurrence is May 22 (Friday). Marking done May 23 (one day late).
    // currentOcc=2026-05-22 (overdueOccurrenceDate), nextOcc=2026-05-29
    const tasks = [makeTask('mow lawn start:2026-05-22T09:00 frequency:weekly')];
    const { tasks: updated, copies } = applyDone(tasks, [1], '2026-05-23');
    expect(copies).toHaveLength(1);
    expect(copies[0]!.done).toBe(true);
    expect(updated[0]!.extensions['start']).toBe('2026-05-29T09:00');
  });

  test('overdue weekly task advances to next occurrence after missed one', () => {
    // Occurrence was June 8 (last-done June 1), marking done June 17 (overdue by 9 days).
    // currentOcc=2026-06-15 (most recent occurrence), nextOcc=2026-06-22
    const tasks = [makeTask('mow lawn start:2026-06-01 frequency:weekly last-done:2026-06-01')];
    const { tasks: updated } = applyDone(tasks, [1], '2026-06-17');
    expect(updated[0]!.extensions['start']).toBe('2026-06-22');
  });

  test('applyDone on daily every:5 task advances start by 5 days', () => {
    // Occurrences: Jan 1, Jan 6, Jan 11, Jan 16...
    // Marking done on Jan 11: currentOcc=Jan 11, nextOcc=Jan 16
    const tasks = [makeTask('water plants start:2026-01-01 frequency:daily every:5')];
    const { tasks: updated } = applyDone(tasks, [1], '2026-01-11');
    expect(updated[0]!.extensions['start']).toBe('2026-01-16');
  });
});

describe('applyDone with frequency:yearly', () => {
  test('does not advance start: year — only last-done changes', () => {
    const tasks = [makeTask('Birthday start:1990-03-15 frequency:yearly type:birthday')];
    const { tasks: updated } = applyDone(tasks, [1], '2026-03-15');
    expect(updated[0]!.extensions['start']).toBe('1990-03-15');
    expect(updated[0]!.extensions['last-done']).toBe('2026-03-15');
  });

  test('start: year stays fixed across multiple completions', () => {
    let tasks = [makeTask('Birthday start:1990-03-15 frequency:yearly type:birthday')];
    tasks = applyDone(tasks, [1], '2026-03-15').tasks;
    tasks = applyDone(tasks, [1], '2027-03-15').tasks;
    expect(tasks[0]!.extensions['start']).toBe('1990-03-15');
    expect(tasks[0]!.extensions['last-done']).toBe('2027-03-15');
  });
});
