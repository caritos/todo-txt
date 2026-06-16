import { describe, test, expect } from '@jest/globals';
import { formatDateLabel, sectionHeader } from '../utils';

// ─── formatDateLabel ───────────────────────────────────────────────────────
describe('formatDateLabel', () => {
  test('formats a plain date as "Mon D"', () => {
    expect(formatDateLabel('2026-01-01')).toBe('Jan 1');
  });

  test('includes time component when date has time suffix', () => {
    expect(formatDateLabel('2026-06-15T09:30')).toBe('Jun 15 09:30');
    expect(formatDateLabel('2026-06-15 14:00')).toBe('Jun 15 14:00');
  });

  test('uses correct month abbreviation for each month', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let m = 0; m < 12; m++) {
      const mm = String(m + 1).padStart(2, '0');
      expect(formatDateLabel(`2026-${mm}-15`)).toBe(`${months[m]} 15`);
    }
  });

  test('does not pad day with leading zero', () => {
    expect(formatDateLabel('2026-03-05')).toBe('Mar 5');
    expect(formatDateLabel('2026-12-01')).toBe('Dec 1');
  });

  test('works with leap day', () => {
    expect(formatDateLabel('2024-02-29')).toBe('Feb 29');
  });

  test('strips only the first 10 chars of dateStr for date parsing', () => {
    // A date + extra suffix beyond 16 chars — should only show up to HH:MM
    expect(formatDateLabel('2026-06-15 09:30:00')).toBe('Jun 15 09:30');
  });
});

// ─── sectionHeader ─────────────────────────────────────────────────────────
describe('sectionHeader', () => {
  const TODAY = '2026-06-16';
  const TOMORROW = '2026-06-17';

  test('returns "TODAY  M/D/YY" for today', () => {
    expect(sectionHeader(TODAY, TODAY)).toBe('TODAY  6/16/26');
  });

  test('returns "TOMORROW  M/D/YY" for tomorrow', () => {
    expect(sectionHeader(TOMORROW, TODAY)).toBe('TOMORROW  6/17/26');
  });

  test('returns uppercase day name for other dates', () => {
    // 2026-06-15 is a Monday
    expect(sectionHeader('2026-06-15', TODAY)).toBe('MON  6/15/26');
  });

  test('returns correct day name for each day of the week', () => {
    // Week of June 14–20, 2026: Sun, Mon, Tue, Wed, Thu, Fri, Sat
    const expected = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let i = 0; i < 7; i++) {
      const day = String(14 + i).padStart(2, '0');
      const dateStr = `2026-06-${day}`;
      if (dateStr === TODAY || dateStr === TOMORROW) continue;
      expect(sectionHeader(dateStr, TODAY)).toContain(expected[i]);
    }
  });

  test('year is 2-digit (YY)', () => {
    expect(sectionHeader('2026-01-01', TODAY)).toContain('/26');
  });

  test('month is not zero-padded', () => {
    expect(sectionHeader('2026-01-15', TODAY)).toContain('1/15/');
  });

  test('works at year boundary: tomorrow is Jan 1', () => {
    const dec31 = '2025-12-31';
    const jan1 = '2026-01-01';
    expect(sectionHeader(jan1, dec31)).toBe('TOMORROW  1/1/26');
  });

  test('past dates return day name, not special label', () => {
    const result = sectionHeader('2026-06-14', TODAY);
    expect(result).not.toContain('TODAY');
    expect(result).not.toContain('TOMORROW');
    expect(result).toBe('SUN  6/14/26');
  });
});
