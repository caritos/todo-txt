import { describe, it, expect, afterEach, spyOn } from 'bun:test';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  mapReminder,
  sanitizeListName,
  buildExistingIds,
  remindersCommand,
} from '../src/commands/reminders';
import type { ReminderRecord, JXAExecutor } from '../src/commands/reminders';

const TMP = join(tmpdir(), `todo-reminders-test-${process.pid}.txt`);
afterEach(() => { if (existsSync(TMP)) unlinkSync(TMP); });

// Base fixture reused across describe blocks
const BASE: ReminderRecord = {
  id: 'ABC-123',
  title: 'Buy groceries',
  list: 'Personal',
  dueDate: null,
  completed: false,
  completionDate: null,
  creationDate: '2026-05-01',
  priority: 0,
  notes: null,
};

describe('sanitizeListName', () => {
  it('leaves simple names unchanged', () => {
    expect(sanitizeListName('Work')).toBe('Work');
  });
  it('replaces spaces with underscores', () => {
    expect(sanitizeListName('My List')).toBe('My_List');
  });
  it('strips non-word characters after spaces are replaced', () => {
    expect(sanitizeListName('Work&Play')).toBe('WorkPlay');
  });
});

describe('mapReminder', () => {
  it('maps a minimal incomplete reminder', () => {
    expect(mapReminder(BASE, '2026-05-06')).toBe(
      '2026-05-01 Buy groceries +Personal reminders-id:ABC-123',
    );
  });
  it('uses todayStr when creationDate is null', () => {
    expect(mapReminder({ ...BASE, creationDate: null }, '2026-05-06')).toContain('2026-05-06');
  });
  it('adds due: when dueDate is set', () => {
    expect(mapReminder({ ...BASE, dueDate: '2026-05-10' }, '2026-05-06')).toContain('due:2026-05-10');
  });
  it('marks completed reminders with x prefix and completionDate', () => {
    const line = mapReminder({ ...BASE, completed: true, completionDate: '2026-04-30' }, '2026-05-06');
    expect(line).toMatch(/^x 2026-04-30 /);
  });
  it('completed with null completionDate uses todayStr as completion date', () => {
    const line = mapReminder({ ...BASE, completed: true, completionDate: null }, '2026-05-06');
    expect(line).toMatch(/^x 2026-05-06 /);
  });
  it('maps priority 1 to (A)', () => {
    expect(mapReminder({ ...BASE, priority: 1 }, '2026-05-06')).toMatch(/^\(A\) /);
  });
  it('maps priority 5 to (B)', () => {
    expect(mapReminder({ ...BASE, priority: 5 }, '2026-05-06')).toMatch(/^\(B\) /);
  });
  it('maps priority 9 to (C)', () => {
    expect(mapReminder({ ...BASE, priority: 9 }, '2026-05-06')).toMatch(/^\(C\) /);
  });
  it('omits priority for priority 0', () => {
    const line = mapReminder(BASE, '2026-05-06');
    expect(line).not.toMatch(/^\([ABC]\) /);
  });
  it('includes sanitized notes as note: extension', () => {
    expect(mapReminder({ ...BASE, notes: 'Check with finance' }, '2026-05-06'))
      .toContain('note:Check_with_finance');
  });
  it('replaces newlines in title with spaces', () => {
    expect(mapReminder({ ...BASE, title: 'Line one\nLine two' }, '2026-05-06'))
      .toContain('Line one Line two');
  });
  it('appends reminders-id extension', () => {
    expect(mapReminder(BASE, '2026-05-06')).toContain('reminders-id:ABC-123');
  });
});
