import { describe, test, expect } from 'bun:test';
import { daysInMonth } from '../utils';

describe('daysInMonth', () => {
  test('returns 30 for June (month0=5)', () => {
    expect(daysInMonth(2026, 5)).toBe(30);
  });

  test('returns 31 for January (month0=0)', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
  });

  test('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  test('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  test('returns 31 for December (month0=11)', () => {
    expect(daysInMonth(2026, 11)).toBe(31);
  });
});
