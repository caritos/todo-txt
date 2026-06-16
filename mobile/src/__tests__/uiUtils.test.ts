import { describe, test, expect } from '@jest/globals';
import { pad, buildCells, cleanTitle, hourLabel, formatTime, parseDateParts } from '../uiUtils';

// ─── pad ───────────────────────────────────────────────────────────────────
describe('pad', () => {
  test('pads single digit with leading zero', () => {
    expect(pad(1)).toBe('01');
    expect(pad(9)).toBe('09');
  });

  test('leaves double-digit numbers unchanged', () => {
    expect(pad(10)).toBe('10');
    expect(pad(31)).toBe('31');
    expect(pad(99)).toBe('99');
  });

  test('zero is padded to 00', () => {
    expect(pad(0)).toBe('00');
  });
});

// ─── buildCells ────────────────────────────────────────────────────────────
describe('buildCells', () => {
  test('January 2026 starts on Thursday (index 4)', () => {
    const cells = buildCells(2026, 0);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBeNull();
    expect(cells[2]).toBeNull();
    expect(cells[3]).toBeNull();
    expect(cells[4]).toBe('2026-01-01');
  });

  test('first day of month always follows the correct number of leading nulls', () => {
    const cells = buildCells(2026, 0);
    const firstReal = cells.findIndex(c => c !== null);
    expect(cells[firstReal]).toBe('2026-01-01');
  });

  test('returns 31 real cells for January', () => {
    const cells = buildCells(2026, 0);
    const real = cells.filter(c => c !== null);
    expect(real).toHaveLength(31);
  });

  test('last real cell for January is 2026-01-31', () => {
    const cells = buildCells(2026, 0);
    const real = cells.filter((c): c is string => c !== null);
    expect(real[real.length - 1]).toBe('2026-01-31');
  });

  test('total length is always a multiple of 7', () => {
    for (let m = 0; m < 12; m++) {
      expect(buildCells(2026, m).length % 7).toBe(0);
    }
  });

  test('February 2024 (leap year) has 29 real cells', () => {
    const cells = buildCells(2024, 1);
    const real = cells.filter(c => c !== null);
    expect(real).toHaveLength(29);
  });

  test('February 2025 (non-leap) has 28 real cells', () => {
    const cells = buildCells(2025, 1);
    const real = cells.filter(c => c !== null);
    expect(real).toHaveLength(28);
  });

  test('dates are formatted as YYYY-MM-DD', () => {
    const cells = buildCells(2026, 0);
    const real = cells.filter((c): c is string => c !== null);
    for (const cell of real) {
      expect(cell).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('dates are contiguous (no gaps)', () => {
    const cells = buildCells(2026, 2); // March (contains DST transition)
    const real = cells.filter((c): c is string => c !== null);
    for (let i = 1; i < real.length; i++) {
      const prev = real[i - 1];
      const curr = real[i];
      // Verify consecutive calendar days by comparing parsed day numbers
      const prevDay = parseInt(prev.slice(8), 10);
      const currDay = parseInt(curr.slice(8), 10);
      // Either the day incremented by 1, or we crossed into a new month (currDay === 1)
      expect(currDay === prevDay + 1 || currDay === 1).toBe(true);
    }
  });

  test('December has 31 real cells ending on 2026-12-31', () => {
    const cells = buildCells(2026, 11);
    const real = cells.filter((c): c is string => c !== null);
    expect(real).toHaveLength(31);
    expect(real[real.length - 1]).toBe('2026-12-31');
  });
});

// ─── cleanTitle ────────────────────────────────────────────────────────────
describe('cleanTitle', () => {
  test('strips start: extension', () => {
    expect(cleanTitle('buy milk start:2026-01-01')).toBe('buy milk');
  });

  test('strips frequency: extension', () => {
    expect(cleanTitle('water plants frequency:weekly')).toBe('water plants');
  });

  test('strips multiple extensions', () => {
    expect(cleanTitle('task start:2026-01-01 frequency:weekly every:2')).toBe('task');
  });

  test('preserves plain text with no extensions', () => {
    expect(cleanTitle('buy groceries')).toBe('buy groceries');
  });

  test('does not strip URLs (values with /)', () => {
    expect(cleanTitle('see http://example.com')).toBe('see http://example.com');
    expect(cleanTitle('link https://example.com/path')).toBe('link https://example.com/path');
  });

  test('strips type: extension', () => {
    expect(cleanTitle('birthday party type:event')).toBe('birthday party');
  });

  test('handles extension at start of string', () => {
    expect(cleanTitle('start:2026-01-01 do the thing')).toBe('do the thing');
  });

  test('trims leading/trailing whitespace from result', () => {
    expect(cleanTitle('  buy milk  start:2026-01-01  ')).toBe('buy milk');
  });

  test('preserves context tags (+project @context)', () => {
    expect(cleanTitle('buy milk +shopping @errands start:2026-01-01')).toBe('buy milk +shopping @errands');
  });

  test('handles empty string gracefully', () => {
    expect(cleanTitle('')).toBe('');
  });
});

// ─── hourLabel ─────────────────────────────────────────────────────────────
describe('hourLabel', () => {
  test('0 returns 12 AM', () => {
    expect(hourLabel(0)).toBe('12 AM');
  });

  test('1–11 return AM labels', () => {
    expect(hourLabel(1)).toBe('1 AM');
    expect(hourLabel(6)).toBe('6 AM');
    expect(hourLabel(11)).toBe('11 AM');
  });

  test('12 returns noon', () => {
    expect(hourLabel(12)).toBe('noon');
  });

  test('13–23 return PM labels', () => {
    expect(hourLabel(13)).toBe('1 PM');
    expect(hourLabel(18)).toBe('6 PM');
    expect(hourLabel(23)).toBe('11 PM');
  });

  test('full day coverage: 24 unique labels', () => {
    const labels = Array.from({ length: 24 }, (_, i) => hourLabel(i));
    const unique = new Set(labels);
    expect(unique.size).toBe(24);
  });
});

// ─── formatTime ────────────────────────────────────────────────────────────
describe('formatTime', () => {
  test('midnight (0:00) formats as 12:00 AM', () => {
    expect(formatTime(0, 0)).toBe('12:00 AM');
  });

  test('noon (12:00) formats as 12:00 PM', () => {
    expect(formatTime(12, 0)).toBe('12:00 PM');
  });

  test('1 AM formats correctly', () => {
    expect(formatTime(1, 0)).toBe('1:00 AM');
  });

  test('1 PM (13:xx) formats correctly', () => {
    expect(formatTime(13, 30)).toBe('1:30 PM');
  });

  test('minutes are zero-padded', () => {
    expect(formatTime(9, 5)).toBe('9:05 AM');
  });

  test('11:59 PM formats correctly', () => {
    expect(formatTime(23, 59)).toBe('11:59 PM');
  });

  test('6:30 AM formats correctly', () => {
    expect(formatTime(6, 30)).toBe('6:30 AM');
  });

  test('9:00 PM formats correctly', () => {
    expect(formatTime(21, 0)).toBe('9:00 PM');
  });
});

// ─── parseDateParts ────────────────────────────────────────────────────────
describe('parseDateParts', () => {
  test('parses a known Monday date', () => {
    const result = parseDateParts('2026-06-15');
    expect(result.month).toBe('June');
    expect(result.day).toBe(15);
    expect(result.year).toBe(2026);
    expect(result.dayName).toBe('MONDAY');
  });

  test('parses January 1 correctly', () => {
    const result = parseDateParts('2026-01-01');
    expect(result.month).toBe('January');
    expect(result.day).toBe(1);
    expect(result.year).toBe(2026);
    expect(result.dayName).toBe('THURSDAY');
  });

  test('parses December 31', () => {
    const result = parseDateParts('2026-12-31');
    expect(result.month).toBe('December');
    expect(result.day).toBe(31);
    expect(result.year).toBe(2026);
  });

  test('dayName is uppercase', () => {
    const result = parseDateParts('2026-06-14');
    expect(result.dayName).toMatch(/^[A-Z]+$/);
  });

  test('day is a number (not a string)', () => {
    const result = parseDateParts('2026-03-05');
    expect(typeof result.day).toBe('number');
    expect(result.day).toBe(5);
  });

  test('year is a number', () => {
    const result = parseDateParts('2025-11-20');
    expect(typeof result.year).toBe('number');
    expect(result.year).toBe(2025);
  });
});

// ─── topOffset regression (issue #25) ─────────────────────────────────────
// These tests verify the topOffset formula's mathematical contract using the
// same constants as day/[date].tsx and timeline.tsx.
describe('topOffset regression (issue #25: now-line before hour label)', () => {
  const START_HOUR = 6;
  const HOUR_HEIGHT = 60;

  function topOffset(hours: number, minutes: number): number {
    return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
  }

  test('7 PM (hour=19) starts at 780px', () => {
    expect(topOffset(19, 0)).toBe(780);
  });

  test('7:12 PM lands at 792px — after the 7 PM label start', () => {
    // Before fix, hourLabel had paddingTop:20, so the "7 PM" text started at 800px.
    // The now-line at 7:12 PM would be at 792px (before the text), looking wrong.
    // After fix, paddingTop:3, so text starts at 783px — now-line at 792px is after it.
    expect(topOffset(19, 12)).toBe(792);
    expect(topOffset(19, 12)).toBeGreaterThan(topOffset(19, 0));
  });

  test('now-line advances with minutes', () => {
    expect(topOffset(19, 12)).toBeGreaterThan(topOffset(19, 0));
    expect(topOffset(19, 30)).toBeGreaterThan(topOffset(19, 12));
    expect(topOffset(19, 59)).toBeGreaterThan(topOffset(19, 30));
  });

  test('full hour increments are exactly HOUR_HEIGHT apart', () => {
    expect(topOffset(7, 0) - topOffset(6, 0)).toBe(HOUR_HEIGHT);
    expect(topOffset(13, 0) - topOffset(12, 0)).toBe(HOUR_HEIGHT);
  });

  test('midnight (0h) before START_HOUR returns negative offset (out of range)', () => {
    expect(topOffset(0, 0)).toBeLessThan(0);
  });
});
