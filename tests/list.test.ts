import { describe, it, expect } from 'bun:test';
import { matchesFilters, isPastEvent, sortByPriority } from '../src/commands/list';
import { parseLine } from '../src/parser';

const TODAY = '2026-05-06';

function makeTask(raw: string) {
  return parseLine(raw, 1);
}

describe('isPastEvent', () => {
  it('returns false for a non-event task', () => {
    const t = makeTask('2026-05-06 Buy groceries');
    expect(isPastEvent(t, TODAY)).toBe(false);
  });

  it('returns false for an event whose end date is today', () => {
    const t = makeTask('2026-05-06 Party start:2026-05-06T10:00 end:2026-05-06T11:00 type:event');
    expect(isPastEvent(t, TODAY)).toBe(false);
  });

  it('returns false for an event whose end date is in the future', () => {
    const t = makeTask('2026-05-06 Conference start:2026-06-01T09:00 end:2026-06-01T17:00 type:event');
    expect(isPastEvent(t, TODAY)).toBe(false);
  });

  it('returns true for an event whose end date is in the past', () => {
    const t = makeTask('2026-03-07 Garage sale start:2026-03-07T09:00 end:2026-03-07T09:30 type:event');
    expect(isPastEvent(t, TODAY)).toBe(true);
  });

  it('returns true for an event with a past date-only end', () => {
    const t = makeTask('2026-03-01 Sprint planning start:2026-03-01 end:2026-03-01 type:event');
    expect(isPastEvent(t, TODAY)).toBe(true);
  });

  it('falls back to start if end is missing', () => {
    const t = makeTask('2026-03-07 Old event start:2026-03-07 type:event');
    expect(isPastEvent(t, TODAY)).toBe(true);
  });

  it('returns false for a non-event type (anniversary)', () => {
    const t = makeTask('2020-01-01 Wedding anniversary start:2020-01-01 type:anniversary');
    expect(isPastEvent(t, TODAY)).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('matches +project filter', () => {
    const t = makeTask('Fix login +work');
    expect(matchesFilters(t, ['+work'])).toBe(true);
    expect(matchesFilters(t, ['+home'])).toBe(false);
  });

  it('matches @context filter', () => {
    const t = makeTask('Buy milk @store');
    expect(matchesFilters(t, ['@store'])).toBe(true);
    expect(matchesFilters(t, ['@home'])).toBe(false);
  });

  it('matches priority filter', () => {
    const t = makeTask('(A) Urgent thing');
    expect(matchesFilters(t, ['(A)'])).toBe(true);
    expect(matchesFilters(t, ['(B)'])).toBe(false);
  });

  it('matches keyword filter case-insensitively', () => {
    const t = makeTask('Send invoice to client');
    expect(matchesFilters(t, ['invoice'])).toBe(true);
    expect(matchesFilters(t, ['INVOICE'])).toBe(true);
    expect(matchesFilters(t, ['banana'])).toBe(false);
  });

  it('ANDs multiple filters', () => {
    const t = makeTask('Fix login +work @computer');
    expect(matchesFilters(t, ['+work', '@computer'])).toBe(true);
    expect(matchesFilters(t, ['+work', '@phone'])).toBe(false);
  });

  it('returns true with no filters', () => {
    const t = makeTask('Any task');
    expect(matchesFilters(t, [])).toBe(true);
  });
});

describe('sortByPriority', () => {
  it('puts (A) before (B) before unprioritized', () => {
    const tasks = [
      parseLine('Buy groceries', 1),
      parseLine('(B) Write docs', 2),
      parseLine('(A) Fix bug', 3),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0]!.priority).toBe('A');
    expect(sorted[1]!.priority).toBe('B');
    expect(sorted[2]!.priority).toBeUndefined();
  });

  it('preserves file order within the same priority level', () => {
    const tasks = [
      parseLine('(A) First A task', 1),
      parseLine('(A) Second A task', 2),
      parseLine('(A) Third A task', 3),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0]!.line).toBe(1);
    expect(sorted[1]!.line).toBe(2);
    expect(sorted[2]!.line).toBe(3);
  });

  it('puts all unprioritized tasks last, preserving their relative order', () => {
    const tasks = [
      parseLine('First no-pri', 1),
      parseLine('(C) A C task', 2),
      parseLine('Second no-pri', 3),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0]!.priority).toBe('C');
    expect(sorted[1]!.line).toBe(1);
    expect(sorted[2]!.line).toBe(3);
  });

  it('does not mutate the original array', () => {
    const tasks = [parseLine('No pri', 1), parseLine('(A) Pri', 2)];
    sortByPriority(tasks);
    expect(tasks[0]!.priority).toBeUndefined();
  });
});
