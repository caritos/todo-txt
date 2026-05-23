import { describe, test, expect } from '@jest/globals';
import { parseNaturalLanguage } from '../nlParser';

const TODAY = '2026-05-23';

describe('parseNaturalLanguage', () => {
  test('plain text returns creation-date-prefixed raw', () => {
    const result = parseNaturalLanguage('call dentist', TODAY);
    expect(result.raw).toBe('2026-05-23 call dentist');
    expect(result.priority).toBeUndefined();
    expect(result.startDate).toBeUndefined();
  });

  test('extracts priority from (A) annotation', () => {
    const result = parseNaturalLanguage('call dentist (A)', TODAY);
    expect(result.raw).toBe('(A) 2026-05-23 call dentist');
    expect(result.priority).toBe('A');
  });

  test('parses "tomorrow" into a start: date', () => {
    const result = parseNaturalLanguage('call dentist tomorrow', TODAY);
    expect(result.startDate).toBe('2026-05-24');
    expect(result.raw).toContain('start:2026-05-24');
    expect(result.raw).not.toContain('tomorrow');
  });

  test('parses time into start: datetime', () => {
    const result = parseNaturalLanguage('dentist at 2pm', TODAY);
    expect(result.startDate).toMatch(/^2026-05-23T14:00$/);
  });

  test('empty string returns creation date only', () => {
    const result = parseNaturalLanguage('', TODAY);
    expect(result.raw).toContain('2026-05-23');
  });
});
