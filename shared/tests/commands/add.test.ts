import { describe, test, expect } from 'bun:test';
import { buildAddRaw } from '../../commands/add';

describe('buildAddRaw', () => {
  test('prepends creation date and appends start:today when no start provided', () => {
    expect(buildAddRaw('call dentist', '2026-05-23')).toBe('2026-05-23 call dentist start:2026-05-23');
  });

  test('priority task gets start:today appended', () => {
    expect(buildAddRaw('(A) urgent task', '2026-05-23')).toBe('(A) 2026-05-23 urgent task start:2026-05-23');
  });

  test('does not override explicit start date', () => {
    const raw = buildAddRaw('water plants start:2026-05-24 frequency:daily', '2026-05-23');
    expect(raw).toBe('2026-05-23 water plants start:2026-05-24 frequency:daily');
  });

  test('throws for invalid frequency value', () => {
    expect(() => buildAddRaw('task frequency:biweekly', '2026-05-23')).toThrow();
  });
});
