# Apple Reminders Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `todo reminders [list-name]` command that queries macOS Reminders via osascript/JXA and appends tasks to todo.txt, with stable-ID deduplication across runs.

**Architecture:** A single `src/commands/reminders.ts` exports pure helpers (`mapReminder`, `buildExistingIds`, `sanitizeListName`) for unit testing and a `remindersCommand` entry point that accepts an optional `JXAExecutor` callback so tests can inject a mock instead of spawning a real osascript process. The JXA script returns a JSON object with all list names and all reminders; TypeScript handles list filtering, deduplication, field mapping, and file append.

**Tech Stack:** Bun, TypeScript, `child_process.execFileSync`, `bun:test`

---

### Task 1: Types, sanitization helpers, and `mapReminder`

**Files:**
- Create: `src/commands/reminders.ts`
- Create: `tests/reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/reminders.test.ts` with all imports the full test file will eventually need:

```typescript
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
  it('completed with null completionDate uses creationDate as second token', () => {
    const line = mapReminder({ ...BASE, completed: true, completionDate: null }, '2026-05-06');
    expect(line).toMatch(/^x \d{4}-\d{2}-\d{2} /);
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/reminders.test.ts
```
Expected: error — module `../src/commands/reminders` not found

- [ ] **Step 3: Implement types, helpers, and `mapReminder` with stub exports**

Create `src/commands/reminders.ts`:

```typescript
import { readFileSync, appendFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { today } from '../output';

export type ReminderRecord = {
  id: string;
  title: string;
  list: string;
  dueDate: string | null;
  completed: boolean;
  completionDate: string | null;
  creationDate: string | null;
  priority: number;
  notes: string | null;
};

type JXAOutput = {
  allLists: string[];
  reminders: ReminderRecord[];
};

export type JXAExecutor = (jxa: string) => string;

const PRIORITY_MAP: Record<number, string> = { 1: '(A)', 5: '(B)', 9: '(C)' };

export function sanitizeListName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^\w]/g, '');
}

function sanitizeExtValue(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\w@._:,/-]/g, '').slice(0, 200);
}

export function mapReminder(r: ReminderRecord, todayStr: string): string {
  const parts: string[] = [];

  if (r.completed) {
    parts.push('x');
    if (r.completionDate) parts.push(r.completionDate);
  } else {
    const pri = PRIORITY_MAP[r.priority];
    if (pri) parts.push(pri);
  }

  parts.push(r.creationDate ?? todayStr);
  parts.push(r.title.replace(/\n/g, ' ').trim().slice(0, 500));

  const listTag = sanitizeListName(r.list);
  if (listTag) parts.push(`+${listTag}`);

  if (r.dueDate) parts.push(`due:${r.dueDate}`);

  if (r.notes) {
    const sanitized = sanitizeExtValue(r.notes);
    if (sanitized) parts.push(`note:${sanitized}`);
  }

  parts.push(`reminders-id:${sanitizeExtValue(r.id)}`);

  return parts.join(' ');
}

// Implemented in Task 2
export function buildExistingIds(_filePath: string): Set<string> {
  return new Set();
}

// Implemented in Task 3
export function remindersCommand(_filePath: string, _args: string[], _executor?: JXAExecutor): void {}
```

- [ ] **Step 4: Run tests**

```bash
bun test tests/reminders.test.ts
```
Expected: all `sanitizeListName` and `mapReminder` tests pass; `buildExistingIds` and `remindersCommand` tests will be added in later tasks

- [ ] **Step 5: Commit**

```bash
git add src/commands/reminders.ts tests/reminders.test.ts
git commit -m "feat: add mapReminder and sanitizeListName for Reminders import"
```

---

### Task 2: `buildExistingIds`

**Files:**
- Modify: `src/commands/reminders.ts`
- Modify: `tests/reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/reminders.test.ts` (after the last describe block):

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/reminders.test.ts -t 'buildExistingIds'
```
Expected: all 4 tests fail — function always returns empty Set

- [ ] **Step 3: Implement `buildExistingIds`**

Replace the stub in `src/commands/reminders.ts`:

```typescript
export function buildExistingIds(filePath: string): Set<string> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return new Set();
  }
  const ids = new Set<string>();
  for (const line of content.split('\n')) {
    const m = line.match(/(?:^|\s)reminders-id:(\S+)/);
    if (m) ids.add(m[1]!);
  }
  return ids;
}
```

- [ ] **Step 4: Run all tests**

```bash
bun test tests/reminders.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/commands/reminders.ts tests/reminders.test.ts
git commit -m "feat: implement buildExistingIds for Reminders deduplication"
```

---

### Task 3: `buildJXA`, `fetchReminders`, and `remindersCommand`

**Files:**
- Modify: `src/commands/reminders.ts`
- Modify: `tests/reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/reminders.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/reminders.test.ts -t 'remindersCommand'
```
Expected: all tests fail — `remindersCommand` is a no-op stub

- [ ] **Step 3: Implement `buildJXA` and full `remindersCommand`**

Replace the stubs in `src/commands/reminders.ts`. Keep all exports from Tasks 1–2 intact; add/replace only these:

```typescript
function buildJXA(): string {
  return `(function() {
  var app = Application('Reminders');
  var allLists = [];
  var reminders = [];
  var lists = app.lists();
  for (var i = 0; i < lists.length; i++) {
    var list = lists[i];
    allLists.push(list.name());
    var items = list.reminders();
    for (var j = 0; j < items.length; j++) {
      var r = items[j];
      function safeDate(d) {
        if (!d) return null;
        try {
          var yyyy = d.getFullYear();
          var mm = String(d.getMonth() + 1).padStart(2, '0');
          var dd = String(d.getDate()).padStart(2, '0');
          return yyyy + '-' + mm + '-' + dd;
        } catch(e) { return null; }
      }
      var dueDate = null;
      try { dueDate = safeDate(r.dueDate()); } catch(e) {}
      var completionDate = null;
      try { completionDate = safeDate(r.completionDate()); } catch(e) {}
      var creationDate = null;
      try { creationDate = safeDate(r.creationDate()); } catch(e) {}
      var notes = null;
      try { var b = r.body(); if (b) notes = String(b); } catch(e) {}
      reminders.push({
        id: r.id(),
        title: r.name(),
        list: list.name(),
        dueDate: dueDate,
        completed: r.completed(),
        completionDate: completionDate,
        creationDate: creationDate,
        priority: r.priority(),
        notes: notes
      });
    }
  }
  return JSON.stringify({ allLists: allLists, reminders: reminders });
})()`;
}

function defaultExecutor(jxa: string): string {
  return execFileSync('osascript', ['-l', 'JavaScript', '-e', jxa], { encoding: 'utf8' });
}

export function remindersCommand(filePath: string, args: string[], executor: JXAExecutor = defaultExecutor): void {
  const listFilter = args[0];
  const todayStr = today();

  const jxa = buildJXA();
  let raw: string;
  try {
    raw = executor(jxa);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error('todo: failed to read Reminders — check System Settings → Privacy & Security → Automation');
    process.exit(1);
  }

  let output: JXAOutput;
  try {
    output = JSON.parse(raw) as JXAOutput;
  } catch {
    console.error('todo: unexpected output from Reminders app');
    process.exit(1);
  }

  if (listFilter && !output.allLists.includes(listFilter)) {
    console.error(`todo: no list named '${listFilter}' found in Reminders`);
    process.exit(1);
  }

  const filtered = listFilter
    ? output.reminders.filter(r => r.list === listFilter)
    : output.reminders;

  if (filtered.length === 0) {
    console.log('No reminders found');
    return;
  }

  const existingIds = buildExistingIds(filePath);
  const newLines: string[] = [];
  let skipped = 0;

  for (const r of filtered) {
    const sanitizedId = sanitizeExtValue(r.id);
    if (existingIds.has(sanitizedId)) {
      skipped++;
      continue;
    }
    newLines.push(mapReminder(r, todayStr));
  }

  if (newLines.length === 0) {
    console.log(`Nothing new to import (all ${filtered.length} reminders already present in todo.txt)`);
    return;
  }

  appendFileSync(filePath, newLines.join('\n') + '\n', 'utf8');

  const basename = filePath.split('/').pop() ?? filePath;
  const skipMsg = skipped > 0 ? ` (${skipped} skipped as duplicates)` : '';
  console.log(`Imported ${newLines.length} reminder${newLines.length === 1 ? '' : 's'}${skipMsg} → ${basename}`);
}
```

- [ ] **Step 4: Run all tests**

```bash
bun test tests/reminders.test.ts
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/commands/reminders.ts tests/reminders.test.ts
git commit -m "feat: implement remindersCommand with JXA and deduplication"
```

---

### Task 4: Wire into CLI and update help

**Files:**
- Modify: `src/index.ts`
- Modify: `src/commands/help.ts`

- [ ] **Step 1: Add import to `src/index.ts`**

Add after the existing `import { importCommand }` line:

```typescript
import { remindersCommand } from './commands/reminders';
```

- [ ] **Step 2: Add `reminders` case to the switch in `src/index.ts`**

Add after the `case 'import':` block:

```typescript
  case 'reminders': {
    remindersCommand(filePath, filteredArgs.slice(1));
    break;
  }
```

- [ ] **Step 3: Add `reminders` entry to `src/commands/help.ts`**

In the commands table in the help string, add after the `import` line:

```
  reminders [list]    Import tasks from Apple Reminders (macOS only)
```

At the end of the examples, add:

```
  todo reminders
  todo reminders Work
```

- [ ] **Step 4: Run the full test suite**

```bash
bun test
```
Expected: all tests pass

- [ ] **Step 5: Smoke-test the help output**

```bash
bun run ./src/index.ts help | grep reminders
```
Expected: `  reminders [list]    Import tasks from Apple Reminders (macOS only)`

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/commands/help.ts
git commit -m "feat: wire reminders command into CLI (issue #6)"
```
