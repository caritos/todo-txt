import { describe, test, expect } from 'bun:test';
import { taskOccurrence, nextMonthlyDate, nextYearlyDate, focusSortKey, generateTaskOccurrences, applyFocusForWindow } from '../../commands/focus';
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

describe('focusSortKey — frequency-day after done', () => {
  // Regression: marking a weekday-recurring task done on Thu should show it on Fri,
  // not skip ahead to Monday. applyDone advances start to the next occurrence (Fri),
  // so the last-done cycle check must not treat Thu's completion as covering Fri.
  test('frequency-day task with last-done on prior day shows next occurrence, not the one after', () => {
    // Simulates state after: t done on Thu Jun 18
    // applyDone advances start to Fri Jun 19 and sets last-done:2026-06-18
    const t = task('%exercise %outdoor %walk start:2026-06-19 frequency:weekly frequency-day:M,T,W,Th,F last-done:2026-06-18');
    // effToday passed by applyFocusForWindow when last-done === todayStr is addDays(nextOcc, 1) = '2026-06-19'
    expect(focusSortKey(t, '2026-06-19')).toBe('2026-06-19');
  });
});

describe('nextMonthlyDate day clamping', () => {
  test('clamps day 31 to Feb 28 in a non-leap year', () => {
    const result = nextMonthlyDate('2026-01-31', '2026-02-01', new Set());
    expect(result).toBe('2026-02-28');
  });

  test('clamps day 31 to Feb 29 in a leap year', () => {
    const result = nextMonthlyDate('2024-01-31', '2024-02-01', new Set());
    expect(result).toBe('2024-02-29');
  });

  test('every>1 branch also clamps', () => {
    // Quarterly (every:3) from Jan 31: cycle lands on Jan(0), Apr(3), Jul(6)...
    // April only has 30 days. Before this fix, dayForMonth() returned the
    // unclamped 31, so new Date(2026, 3, 31) silently overflowed to May 1 —
    // verified by running this exact call against the pre-fix code, which
    // returned '2026-05-01'. After clamping it must return April 30 instead.
    const result = nextMonthlyDate('2026-01-31', '2026-04-01', new Set(), undefined, 3);
    expect(result).toBe('2026-04-30');
  });
});

describe('nextYearlyDate day clamping', () => {
  test('clamps June 31 to June 30', () => {
    // start's literal day (31) doesn't exist in June (30 days)
    const result = nextYearlyDate('2028-06-31', '2026-07-01', new Set());
    expect(result).toBe('2027-06-30');
  });

  test('clamps Feb 29 to Feb 28 in a non-leap year', () => {
    const result = nextYearlyDate('1990-02-29', '2026-01-01', new Set());
    expect(result).toBe('2026-02-28');
  });

  test('keeps Feb 29 in a leap year', () => {
    const result = nextYearlyDate('1990-02-29', '2024-01-01', new Set());
    expect(result).toBe('2024-02-29');
  });

  test('every>1 branch also clamps', () => {
    const result = nextYearlyDate('2020-06-31', '2026-01-01', new Set(), undefined, 2);
    expect(result).toBe('2026-06-30');
  });
});

describe('applyFocusForWindow — overdueDate', () => {
  // Reproduces issue reported against the mobile calendar: a weekly task overdue
  // by more than a full cycle showed on today's list with a plain time (09:00)
  // instead of a "due Jul 3" label, because the only overdue signal available
  // to callers was a boolean — the actual missed date was discarded.
  test('weekly task overdue by more than one cycle exposes the missed occurrence date', () => {
    const t = task('mow the front lawn start start:2026-06-19T09:00 frequency:weekly last-done:2026-06-11 exdate:2026-06-05');
    const items = applyFocusForWindow([t], '2026-07-05', '2026-07-19');
    expect(items).toHaveLength(1);
    expect(items[0]!.isOverdue).toBe(true);
    expect(items[0]!.overdueDate).toBe('2026-07-03');
  });

  test('weekly task completed within the current cycle is not overdue and has a null overdueDate', () => {
    const t = task('weekly review start:2026-06-14 frequency:weekly last-done:2026-06-14');
    const items = applyFocusForWindow([t], '2026-06-15', '2026-06-29');
    expect(items).toHaveLength(1);
    expect(items[0]!.isOverdue).toBe(false);
    expect(items[0]!.overdueDate).toBeNull();
  });

  test('typed recurring event never reports an overdueDate (ongoing-event "today" display is intentional)', () => {
    const t = task('standup type:event start:2026-06-14T09:00 frequency:weekly');
    const items = applyFocusForWindow([t], '2026-06-15', '2026-06-29');
    expect(items).toHaveLength(1);
    expect(items[0]!.isOverdue).toBe(false);
    expect(items[0]!.overdueDate).toBeNull();
  });

  test('plain non-recurring task with start: in the past reports its start date as overdueDate', () => {
    const t = task('past scheduled task start:2026-06-01');
    const items = applyFocusForWindow([t], '2026-06-15', '2026-06-29');
    expect(items).toHaveLength(1);
    expect(items[0]!.isOverdue).toBe(true);
    expect(items[0]!.overdueDate).toBe('2026-06-01');
  });

  // Reported bug: a weekly task overdue since Jul 3 (2 days overdue) sorted below
  // a task merely due today, because sorting used the collapsed "today" sort key
  // for overdue recurring tasks instead of their true missed date.
  test('overdue recurring task sorts by its true missed date, ahead of a task merely due today', () => {
    const overdueLawn = task('mow the front lawn start start:2026-06-19T09:00 frequency:weekly last-done:2026-06-11 exdate:2026-06-05');
    const dueToday = task('ai weekly review on obsidian notes start:2026-07-05');
    const items = applyFocusForWindow([dueToday, overdueLawn], '2026-07-05', '2026-07-19');
    expect(items.map(i => i.task.raw)).toEqual([overdueLawn.raw, dueToday.raw]);
  });

  // Reported bug: right after marking a weekly task done today, applyDone advances start to
  // next week (per the "done advances start" invariant) and sets last-done to today. The task
  // then reappeared on TODAY's list with a "due" (overdue) label for its own future occurrence,
  // because effToday's "skip past the just-completed occurrence" shift assumed start still
  // pointed at today's (unadvanced) occurrence, and blindly added another day on top of the
  // already-advanced future start — landing one day past a 7-day cycle boundary and forcing
  // an extra full week's advance downstream, which overdueOccurrenceDate then misread as overdue.
  test('weekly task just completed today (start already advanced to next week) is not overdue and shows on its real next date', () => {
    const t = task('transcribe voice memos start:2026-07-12T06:00 frequency:weekly last-done:2026-07-05');
    const items = applyFocusForWindow([t], '2026-07-05', '2026-07-19');
    expect(items).toHaveLength(1);
    expect(items[0]!.isOverdue).toBe(false);
    expect(items[0]!.overdueDate).toBeNull();
    expect(items[0]!.effectiveDate).toBe('2026-07-12T06:00');
  });
});

describe('generateTaskOccurrences', () => {
  test('multi-day non-recurring event expands to one occurrence per day', () => {
    const t = task('art class type:event start:2026-07-13 end:2026-07-17');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
    ]);
  });

  test('single-day event with no end: still returns exactly one occurrence', () => {
    const t = task('birthday party type:event start:2026-07-13');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual(['2026-07-13']);
  });

  test('span partially outside the query window only returns in-window days', () => {
    const t = task('art class type:event start:2026-07-13 end:2026-07-17');
    const occs = generateTaskOccurrences(t, '2026-07-15', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual(['2026-07-15', '2026-07-16', '2026-07-17']);
  });

  test('garbage far-future end: does not loop past effectiveCutoff', () => {
    const t = task('art class type:event start:2026-07-13 end:2099-01-01');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-20');
    expect(occs).toHaveLength(8); // 07-13 through 07-20 inclusive
    expect(occs[occs.length - 1]!.date).toBe('2026-07-20');
  });

  test('end: before start: (reversed/malformed data) degrades to a single day instead of vanishing', () => {
    const t = task('art class type:event start:2026-07-17 end:2026-07-13');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual(['2026-07-17']);
  });
});
