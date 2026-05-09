import { describe, it, expect } from '@jest/globals';
import { parseLine, serializeTask, baseText } from '../src/parser';
import type { Task } from '../src/parser';

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

describe('serializeTask', () => {
  it('serializes a simple task', () => {
    const task: Task = {
      line: 1, raw: '', done: false,
      text: 'Buy groceries', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('Buy groceries');
  });

  it('serializes a task with priority', () => {
    const task: Task = {
      line: 1, raw: '', done: false, priority: 'A',
      text: 'Fix login bug', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('(A) Fix login bug');
  });

  it('serializes a task with priority and creation date', () => {
    const task: Task = {
      line: 1, raw: '', done: false, priority: 'B',
      creationDate: '2026-05-01', text: 'Write docs',
      projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('(B) 2026-05-01 Write docs');
  });

  it('serializes a completed task with both dates', () => {
    const task: Task = {
      line: 1, raw: '', done: true,
      completionDate: '2026-05-04', creationDate: '2026-05-01',
      text: 'Deploy server +backend',
      projects: ['+backend'], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 2026-05-01 Deploy server +backend');
  });

  it('serializes a completed task with completion date only', () => {
    const task: Task = {
      line: 1, raw: '', done: true, completionDate: '2026-05-04',
      text: 'Quick fix', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 Quick fix');
  });

  it('does not include priority for completed tasks', () => {
    const task: Task = {
      line: 1, raw: '', done: true,
      completionDate: '2026-05-04', priority: undefined,
      text: 'Was urgent', projects: [], contexts: [], extensions: {},
    };
    expect(serializeTask(task)).toBe('x 2026-05-04 Was urgent');
  });

  it('round-trips: parse then serialize reproduces original line', () => {
    const lines = [
      '(A) 2026-05-01 Fix login bug +backend @work due:2026-05-10',
      'x 2026-05-04 2026-05-01 Deploy server +backend @work',
      'Buy groceries @personal',
      '(C) Review pull requests +backend @work due:2026-05-07',
    ];
    for (const line of lines) {
      expect(serializeTask(parseLine(line, 1))).toBe(line);
    }
  });
});

describe('baseText', () => {
  it('returns plain text unchanged', () => {
    expect(baseText('Buy groceries')).toBe('Buy groceries');
  });

  it('strips key:value extensions', () => {
    expect(baseText('stoicism start:2026-05-08T06:00 frequency:daily')).toBe('stoicism');
  });

  it('keeps +project and @context tags', () => {
    expect(baseText('morning reflection +family start:2026-05-08T06:00 frequency:daily')).toBe('morning reflection +family');
  });

  it('strips last-done extension', () => {
    expect(baseText('stoicism frequency:daily last-done:2026-05-08')).toBe('stoicism');
  });

  it('strips every: extension', () => {
    expect(baseText('review rss feeds frequency:daily every:1')).toBe('review rss feeds');
  });
});
