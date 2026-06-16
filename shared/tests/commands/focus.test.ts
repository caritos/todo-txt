import { describe, test, expect } from 'bun:test';
import { taskOccurrence, nextMonthlyDate, nextYearlyDate } from '../../commands/focus';
import { parseLine } from '../../parser';

function task(raw: string) { return parseLine(raw, 1); }
const TODAY = '2026-06-15';

describe('taskOccurrence', () => {
  test('returns null for task with no start or due', () => {
    expect(taskOccurrence(task('buy milk'), TODAY)).toBeNull();
  });

  test('plain task with ISO start date', () => {
    const t = task(`buy milk start:${TODAY}`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: null });
  });

  test('plain task with start:today literal', () => {
    const t = task('buy milk start:today');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: null });
  });

  test('timed task with ISO start date+time (T separator)', () => {
    const t = task(`call mom start:${TODAY}T09:00`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: '09:00' });
  });

  test('timed task with start:todayTHH:MM literal', () => {
    const t = task('call mom start:todayT06:00');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: '06:00' });
  });

  test('weekly recurring task shows current occurrence', () => {
    // start was last week (Monday June 8), frequency weekly — next occurrence should be this Monday June 15
    const t = task(`mow lawn start:2026-06-08T09:00 frequency:weekly`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: '2026-06-15', time: '09:00' });
  });

  test('task with only due date', () => {
    const t = task('submit report due:2026-06-20');
    const occ = taskOccurrence(t, TODAY);
    expect(occ?.date).toBe('2026-06-20');
    expect(occ?.time).toBeNull();
  });

  test('future task returns its future date', () => {
    const t = task('dentist start:2026-07-01');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: '2026-07-01', time: null });
  });
});

describe('nextYearlyDate with every', () => {
  test('every:2 — biannual starting Jan 1 2024, today is Jan 2 2026', () => {
    // Occurrences: 2024-01-01, 2026-01-01, 2028-01-01 — next after Jan 2 2026 is 2028
    expect(nextYearlyDate('2024-01-01', '2026-01-02', new Set(), undefined, 2)).toBe('2028-01-01');
  });

  test('every:2 — biannual starting Jan 1 2024, today is Jan 1 2026 exactly', () => {
    expect(nextYearlyDate('2024-01-01', '2026-01-01', new Set(), undefined, 2)).toBe('2026-01-01');
  });

  test('every:2 — biannual starting Jan 1 2024, today is Jan 1 2025', () => {
    // Between occurrences — next is 2026
    expect(nextYearlyDate('2024-01-01', '2025-01-01', new Set(), undefined, 2)).toBe('2026-01-01');
  });
});

describe('nextMonthlyDate with every', () => {
  test('every:3 — quarterly starting Jan 1, today is Apr 2', () => {
    // Jan 1 → Apr 1 → Jul 1 → Oct 1
    expect(nextMonthlyDate('2026-01-01', '2026-04-02', new Set(), undefined, 3)).toBe('2026-07-01');
  });

  test('every:3 — quarterly starting Jan 1, today is Apr 1 exactly', () => {
    expect(nextMonthlyDate('2026-01-01', '2026-04-01', new Set(), undefined, 3)).toBe('2026-04-01');
  });

  test('every:3 — quarterly starting Jan 15, today is Jan 10', () => {
    // Not yet reached first occurrence
    expect(nextMonthlyDate('2026-01-15', '2026-01-10', new Set(), undefined, 3)).toBe('2026-01-15');
  });
});
