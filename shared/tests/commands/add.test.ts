import { describe, test, expect } from 'bun:test';
import { buildAddRaw } from '../../commands/add';

describe('buildAddRaw', () => {
  test('prepends creation date to plain task text', () => {
    expect(buildAddRaw('call dentist', '2026-05-23')).toBe('2026-05-23 call dentist');
  });

  test('preserves priority and inserts date after it', () => {
    expect(buildAddRaw('(A) urgent task', '2026-05-23')).toBe('(A) 2026-05-23 urgent task');
  });

  test('preserves extensions in task text', () => {
    const raw = buildAddRaw('water plants start:2026-05-24 frequency:daily', '2026-05-23');
    expect(raw).toBe('2026-05-23 water plants start:2026-05-24 frequency:daily');
  });

  test('throws for invalid frequency value', () => {
    expect(() => buildAddRaw('task frequency:biweekly', '2026-05-23')).toThrow();
  });
});
