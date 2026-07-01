import { describe, test, expect } from 'bun:test';
import { matchesFilters, sortByPriority, isPastEvent, toJsonTask, computeYearCount } from '../../commands/list';
import { parseLine } from '../../parser';

describe('matchesFilters', () => {
  test('matches project filter', () => {
    const t = parseLine('fix bug +backend', 1);
    expect(matchesFilters(t, ['+backend'])).toBe(true);
    expect(matchesFilters(t, ['+frontend'])).toBe(false);
  });

  test('matches context filter', () => {
    const t = parseLine('call dentist @phone', 1);
    expect(matchesFilters(t, ['@phone'])).toBe(true);
  });

  test('matches priority filter', () => {
    const t = parseLine('(A) urgent task', 1);
    expect(matchesFilters(t, ['(A)'])).toBe(true);
    expect(matchesFilters(t, ['(B)'])).toBe(false);
  });

  test('matches keyword filter case-insensitively', () => {
    const t = parseLine('Call Dentist', 1);
    expect(matchesFilters(t, ['dentist'])).toBe(true);
  });

  test('ANDs multiple filters', () => {
    const t = parseLine('fix bug +backend @work', 1);
    expect(matchesFilters(t, ['+backend', '@work'])).toBe(true);
    expect(matchesFilters(t, ['+backend', '@home'])).toBe(false);
  });
});

describe('sortByPriority', () => {
  test('sorts A before B before unprioritized', () => {
    const tasks = [
      parseLine('no priority', 1),
      parseLine('(B) medium', 2),
      parseLine('(A) urgent', 3),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0]!.priority).toBe('A');
    expect(sorted[1]!.priority).toBe('B');
    expect(sorted[2]!.priority).toBeUndefined();
  });
});

describe('isPastEvent', () => {
  test('returns false for non-event tasks', () => {
    const t = parseLine('regular task start:2020-01-01', 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(false);
  });

  test('returns true for past one-time event', () => {
    const t = parseLine('party type:event start:2020-01-01', 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(true);
  });

  test('returns false for birthday (yearly, never past)', () => {
    const t = parseLine("Mom's birthday type:birthday start:1980-06-15 frequency:yearly", 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(false);
  });
});

describe('computeYearCount', () => {
  test('computes years for type:birthday', () => {
    const t = parseLine('John Birthday start:1990-03-15 frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-03-15')).toBe(36);
  });

  test('computes years for type:anniversary', () => {
    const t = parseLine('Anniversary start:1984-05-06 frequency:yearly type:anniversary', 1);
    expect(computeYearCount(t, '2026-05-06')).toBe(42);
  });

  test('returns undefined for type:event', () => {
    const t = parseLine('Team standup start:2024-05-06 type:event', 1);
    expect(computeYearCount(t, '2026-05-06')).toBeUndefined();
  });

  test('returns undefined when start: is missing', () => {
    const t = parseLine('Birthday frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-05-06')).toBeUndefined();
  });

  test('returns undefined when years would be zero or negative', () => {
    const t = parseLine('Birthday start:2026-03-15 frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-03-15')).toBeUndefined();
  });
});
