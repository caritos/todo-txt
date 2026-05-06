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

describe('buildExistingIds', () => {
  it('returns empty set for non-existent file', () => {
    expect(buildExistingIds('/nonexistent/path.txt').size).toBe(0);
  });
  it('extracts reminders-id value from a task line', () => {
    writeFileSync(TMP, '2026-05-01 Buy groceries +Personal reminders-id:ABC-123\n', 'utf8');
    expect(buildExistingIds(TMP).has('ABC-123')).toBe(true);
  });
  it('handles multiple tasks each with an id', () => {
    writeFileSync(TMP, [
      '2026-05-01 Task one reminders-id:AAA',
      '2026-05-01 Task two reminders-id:BBB',
    ].join('\n') + '\n', 'utf8');
    const ids = buildExistingIds(TMP);
    expect(ids.has('AAA')).toBe(true);
    expect(ids.has('BBB')).toBe(true);
  });
  it('ignores lines without reminders-id', () => {
    writeFileSync(TMP, '2026-05-01 Plain task\n', 'utf8');
    expect(buildExistingIds(TMP).size).toBe(0);
  });
});

// Fixture with dueDate for end-to-end command tests
const FIXTURE: ReminderRecord = { ...BASE, dueDate: '2026-05-10' };

function makeExecutor(reminders: ReminderRecord[], allLists?: string[]): JXAExecutor {
  const lists = allLists ?? [...new Set(reminders.map(r => r.list))];
  return (_jxa: string) => JSON.stringify({ allLists: lists, reminders });
}

describe('remindersCommand', () => {
  it('appends new reminders to the file', () => {
    writeFileSync(TMP, '', 'utf8');
    remindersCommand(TMP, [], makeExecutor([FIXTURE]));
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain('Buy groceries +Personal');
    expect(content).toContain('due:2026-05-10');
    expect(content).toContain('reminders-id:ABC-123');
  });

  it('skips duplicate reminders by reminders-id', () => {
    writeFileSync(TMP, '2026-05-01 Buy groceries +Personal reminders-id:ABC-123\n', 'utf8');
    remindersCommand(TMP, [], makeExecutor([FIXTURE]));
    const lines = readFileSync(TMP, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('prints message and leaves file unchanged when all already imported', () => {
    writeFileSync(TMP, '2026-05-01 Buy groceries +Personal reminders-id:ABC-123\n', 'utf8');
    remindersCommand(TMP, [], makeExecutor([FIXTURE]));
    expect(readFileSync(TMP, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('filters by list name when argument provided', () => {
    const workItem: ReminderRecord = { ...BASE, id: 'XYZ-789', title: 'Write report', list: 'Work' };
    writeFileSync(TMP, '', 'utf8');
    remindersCommand(TMP, ['Work'], makeExecutor([FIXTURE, workItem], ['Personal', 'Work']));
    const content = readFileSync(TMP, 'utf8');
    expect(content).toContain('Write report');
    expect(content).not.toContain('Buy groceries');
  });

  it('prints message and does not write file when no reminders found', () => {
    writeFileSync(TMP, '', 'utf8');
    remindersCommand(TMP, [], makeExecutor([], []));
    expect(readFileSync(TMP, 'utf8')).toBe('');
  });

  it('exits 1 when named list does not exist', () => {
    const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as any);
    try {
      expect(() =>
        remindersCommand(TMP, ['Nonexistent'], makeExecutor([], ['Personal']))
      ).toThrow('process.exit');
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('exits 1 on invalid JSON from executor', () => {
    const exitSpy = spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as any);
    try {
      expect(() =>
        remindersCommand(TMP, [], (_jxa: string) => 'not-json')
      ).toThrow('process.exit');
    } finally {
      exitSpy.mockRestore();
    }
  });
});
