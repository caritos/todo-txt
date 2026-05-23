import { describe, test, expect } from 'bun:test';
import { applySearch } from '../../commands/search';
import { parseLine } from '../../parser';

describe('applySearch', () => {
  test('returns tasks matching the term case-insensitively', () => {
    const tasks = [parseLine('Call Dentist', 1), parseLine('buy groceries', 2)];
    const matches = applySearch(tasks, 'dentist');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.text).toContain('Dentist');
  });

  test('returns empty array when nothing matches', () => {
    const tasks = [parseLine('buy groceries', 1)];
    expect(applySearch(tasks, 'dentist')).toHaveLength(0);
  });

  test('searches in extensions and raw text', () => {
    const tasks = [parseLine('water plants due:2026-06-01', 1)];
    expect(applySearch(tasks, '2026-06-01')).toHaveLength(1);
  });
});
