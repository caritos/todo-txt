import { describe, it, expect } from 'bun:test';
import { parseLine } from '../src/parser';

describe('parseLine', () => {
  it('parses a simple task', () => {
    const t = parseLine('Buy groceries', 1);
    expect(t.line).toBe(1);
    expect(t.raw).toBe('Buy groceries');
    expect(t.done).toBe(false);
    expect(t.priority).toBeUndefined();
    expect(t.creationDate).toBeUndefined();
    expect(t.text).toBe('Buy groceries');
    expect(t.projects).toEqual([]);
    expect(t.contexts).toEqual([]);
    expect(t.extensions).toEqual({});
  });

  it('parses priority', () => {
    const t = parseLine('(A) Fix login bug', 1);
    expect(t.priority).toBe('A');
    expect(t.text).toBe('Fix login bug');
  });

  it('parses priority and creation date', () => {
    const t = parseLine('(B) 2026-05-01 Write docs', 2);
    expect(t.priority).toBe('B');
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Write docs');
  });

  it('parses creation date without priority', () => {
    const t = parseLine('2026-05-01 Call dentist', 3);
    expect(t.priority).toBeUndefined();
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Call dentist');
  });

  it('parses projects and contexts', () => {
    const t = parseLine('Fix bug +backend @work', 1);
    expect(t.projects).toEqual(['+backend']);
    expect(t.contexts).toEqual(['@work']);
    expect(t.text).toBe('Fix bug +backend @work');
  });

  it('parses multiple projects and contexts', () => {
    const t = parseLine('Fix thing +backend +api @work @phone', 1);
    expect(t.projects).toEqual(['+backend', '+api']);
    expect(t.contexts).toEqual(['@work', '@phone']);
  });

  it('parses key:value extensions', () => {
    const t = parseLine('Call dentist due:2026-05-10', 1);
    expect(t.extensions).toEqual({ due: '2026-05-10' });
  });

  it('parses a completed task with both dates', () => {
    const t = parseLine('x 2026-05-04 2026-05-01 Deploy server +backend', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBe('2026-05-04');
    expect(t.creationDate).toBe('2026-05-01');
    expect(t.text).toBe('Deploy server +backend');
    expect(t.projects).toEqual(['+backend']);
  });

  it('parses a completed task with completion date only', () => {
    const t = parseLine('x 2026-05-04 Deploy server', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBe('2026-05-04');
    expect(t.creationDate).toBeUndefined();
    expect(t.text).toBe('Deploy server');
  });

  it('parses a completed task with no dates', () => {
    const t = parseLine('x Deploy server', 1);
    expect(t.done).toBe(true);
    expect(t.completionDate).toBeUndefined();
    expect(t.text).toBe('Deploy server');
  });

  it('does not treat lowercase x mid-word as done marker', () => {
    const t = parseLine('Fix xerox machine', 1);
    expect(t.done).toBe(false);
    expect(t.text).toBe('Fix xerox machine');
  });

  it('does not parse priority mid-line', () => {
    const t = parseLine('Fix (A) bug', 1);
    expect(t.priority).toBeUndefined();
    expect(t.text).toBe('Fix (A) bug');
  });

  it('preserves raw line and line number', () => {
    const raw = '(A) 2026-05-01 Fix bug +backend @work due:2026-05-10';
    const t = parseLine(raw, 5);
    expect(t.raw).toBe(raw);
    expect(t.line).toBe(5);
  });
});
