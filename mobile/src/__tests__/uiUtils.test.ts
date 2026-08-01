import { describe, test, expect } from '@jest/globals';
import { pad, buildCells, cleanTitle, hourLabel, formatTime, parseDateParts, formatMonthDayNumeric, daysUntil, daysLeftLabel, timeMinutes, defaultEndTime } from '../uiUtils';

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

  test('strips %birthday tag', () => {
    expect(cleanTitle("Mom's Birthday %birthday start:1975-06-15")).toBe("Mom's Birthday");
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

// ─── formatMonthDayNumeric ─────────────────────────────────────────────────
describe('formatMonthDayNumeric', () => {
  test('double-digit month and double-digit day', () => {
    expect(formatMonthDayNumeric('2026-08-19')).toBe('8/19');
  });

  test('single-digit month and single-digit day', () => {
    expect(formatMonthDayNumeric('2026-01-05')).toBe('1/5');
  });

  test('single-digit month and double-digit day', () => {
    expect(formatMonthDayNumeric('2026-03-31')).toBe('3/31');
  });
});

// ─── daysUntil ───────────────────────────────────────────────────────────────
describe('daysUntil', () => {
  test('counts forward across a month boundary', () => {
    expect(daysUntil('2026-08-01', '2026-08-19')).toBe(18);
  });

  test('zero when the two dates are the same', () => {
    expect(daysUntil('2026-08-19', '2026-08-19')).toBe(0);
  });

  test('one day before the end date', () => {
    expect(daysUntil('2026-08-18', '2026-08-19')).toBe(1);
  });
});

// ─── daysLeftLabel ─────────────────────────────────────────────────────────
describe('daysLeftLabel', () => {
  test('multiple days left', () => {
    expect(daysLeftLabel(18)).toBe('18d left');
  });

  test('one day left', () => {
    expect(daysLeftLabel(1)).toBe('1d left');
  });

  test('zero days left reads as the last day', () => {
    expect(daysLeftLabel(0)).toBe('last day');
  });
});

// ─── timeMinutes ───────────────────────────────────────────────────────────
describe('timeMinutes', () => {
  test('midnight is 0', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 0, 0))).toBe(0);
  });

  test('9:30 AM is 570', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 9, 30))).toBe(570);
  });

  test('11:59 PM is 1439', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 23, 59))).toBe(1439);
  });

  test('ignores date components, only reads hours/minutes', () => {
    expect(timeMinutes(new Date(2020, 5, 15, 14, 0))).toBe(timeMinutes(new Date(2030, 0, 1, 14, 0)));
  });
});

// ─── defaultEndTime ────────────────────────────────────────────────────────
describe('defaultEndTime', () => {
  test('adds 60 minutes to a mid-day start', () => {
    const start = new Date(2026, 0, 1, 9, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(0);
  });

  test('preserves the calendar date of start', () => {
    const start = new Date(2026, 6, 15, 9, 0);
    const end = defaultEndTime(start);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(15);
  });

  test('clamps to 23:59 instead of rolling into the next day', () => {
    const start = new Date(2026, 0, 1, 23, 30);
    const end = defaultEndTime(start);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  test('23:00 plus 60 minutes clamps to 23:59, not 24:00', () => {
    const start = new Date(2026, 0, 1, 23, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  test('22:00 plus 60 minutes is exactly 23:00 (no clamping needed)', () => {
    const start = new Date(2026, 0, 1, 22, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(0);
  });
});
