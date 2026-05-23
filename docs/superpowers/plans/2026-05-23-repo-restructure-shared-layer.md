# Repo Restructure + Shared Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the repo so `src/` becomes `console/`, pure business logic moves to `shared/commands/`, and all 309 existing tests still pass.

**Architecture:** Three root-level directories — `shared/` (pure transforms, no I/O, no `process.exit`), `console/` (renamed from `src/`, thin CLI wrappers + ANSI output), `mobile/` (future Expo app, not in this plan). Each command in `shared/commands/` takes `Task[]` + params and returns a plain result object; the `console/commands/` wrapper handles `readTasks`/`writeTasks`/`console.log`. This is a purely mechanical move — zero behavior changes.

**Tech Stack:** TypeScript, Bun, `bun test`

---

## File Map

```
shared/
  utils.ts                 ← addDays() extracted from output.ts (needed by shared transforms)
  parser.ts                ← moved from src/parser.ts (no changes)
  recurrence.ts            ← moved from src/recurrence.ts (no changes)
  commands/
    list.ts                ← matchesFilters, sortByPriority, isPastEvent, toJsonTask, JsonTask
    focus.ts               ← nextWeeklyDate, nextMonthlyDate, nextYearlyDate, focusSortKey,
                              FocusItem type, applyFocus (all pure; no I/O)
    done.ts                ← applyDone (throws Error instead of process.exit)
    skip.ts                ← applySkip
    add.ts                 ← buildAddRaw
    rm.ts                  ← applyRm
    edit.ts                ← applyEdit
    pri.ts                 ← applyPri, applyDepri
    search.ts              ← applySearch
    report.ts              ← ReportResult type, applyReport
  tests/
    parser.test.ts         ← moved from tests/parser.test.ts (import path updated)
    recurrence.test.ts     ← moved from tests/recurrence.test.ts (import path updated)
    commands/
      add.test.ts          ← NEW: unit tests for buildAddRaw
      rm.test.ts           ← NEW: unit tests for applyRm
      done.test.ts         ← NEW: unit tests for applyDone
      pri.test.ts          ← NEW: unit tests for applyPri/applyDepri
      edit.test.ts         ← NEW: unit tests for applyEdit
      search.test.ts       ← NEW: unit tests for applySearch
      report.test.ts       ← NEW: unit tests for applyReport

console/
  index.ts                 ← moved from src/index.ts (import paths updated)
  store.ts                 ← moved from src/store.ts (import path: shared/parser)
  output.ts                ← moved from src/output.ts (addDays removed, imported from shared)
  commands/
    add.ts                 ← thin wrapper: buildAddRaw + appendFileSync + log
    done.ts                ← thin wrapper: applyDone + readTasks/writeTasks + log
    edit.ts                ← thin wrapper: applyEdit + readTasks/writeTasks + log
    event.ts               ← unchanged (CLI-only)
    focus.ts               ← thin wrapper: applyFocus + readTasks + formatFocusTask
    help.ts                ← unchanged
    import.ts              ← unchanged (CLI-only)
    list.ts                ← thin wrapper: reads tasks, calls matchesFilters/sortByPriority
    listall.ts             ← thin wrapper: reads tasks, calls matchesFilters
    pri.ts                 ← thin wrapper: applyPri/applyDepri + readTasks/writeTasks + log
    reminders.ts           ← unchanged (CLI-only)
    report.ts              ← thin wrapper: applyReport + readTasks + console.log
    rm.ts                  ← thin wrapper: applyRm + readTasks/writeTasks + log
    search.ts              ← thin wrapper: applySearch + readTasks + formatTask
    skip.ts                ← thin wrapper: applySkip + readTasks/writeTasks + log
  tests/
    store.test.ts          ← moved from tests/store.test.ts (import path updated)
    list.test.ts           ← moved from tests/list.test.ts (CLI path updated)
    reminders.test.ts      ← moved from tests/reminders.test.ts (CLI path updated)
    commands/              ← all moved from tests/commands/ (CLI path updated)
      *.test.ts
```

---

## Task 1: Scaffold + git mv

**Files:** New directory structure; move all existing files.

- [ ] **Create new directories**

```bash
mkdir -p shared/commands shared/tests/commands
mkdir -p console/commands console/tests/commands
```

- [ ] **Move source files to console/ with git history**

```bash
git mv src/index.ts console/index.ts
git mv src/store.ts console/store.ts
git mv src/output.ts console/output.ts
git mv src/commands/add.ts console/commands/add.ts
git mv src/commands/done.ts console/commands/done.ts
git mv src/commands/edit.ts console/commands/edit.ts
git mv src/commands/event.ts console/commands/event.ts
git mv src/commands/focus.ts console/commands/focus.ts
git mv src/commands/help.ts console/commands/help.ts
git mv src/commands/import.ts console/commands/import.ts
git mv src/commands/list.ts console/commands/list.ts
git mv src/commands/listall.ts console/commands/listall.ts
git mv src/commands/pri.ts console/commands/pri.ts
git mv src/commands/reminders.ts console/commands/reminders.ts
git mv src/commands/report.ts console/commands/report.ts
git mv src/commands/rm.ts console/commands/rm.ts
git mv src/commands/search.ts console/commands/search.ts
git mv src/commands/skip.ts console/commands/skip.ts
```

- [ ] **Move parser and recurrence to shared/**

```bash
git mv src/parser.ts shared/parser.ts
git mv src/recurrence.ts shared/recurrence.ts
rmdir src/commands src
```

- [ ] **Move tests to their new homes**

```bash
git mv tests/parser.test.ts shared/tests/parser.test.ts
git mv tests/recurrence.test.ts shared/tests/recurrence.test.ts
git mv tests/store.test.ts console/tests/store.test.ts
git mv tests/list.test.ts console/tests/list.test.ts
git mv tests/reminders.test.ts console/tests/reminders.test.ts
git mv tests/commands/add.test.ts console/tests/commands/add.test.ts
git mv tests/commands/done.test.ts console/tests/commands/done.test.ts
git mv tests/commands/edit.test.ts console/tests/commands/edit.test.ts
git mv tests/commands/event.test.ts console/tests/commands/event.test.ts
git mv tests/commands/focus.test.ts console/tests/commands/focus.test.ts
git mv tests/commands/help.test.ts console/tests/commands/help.test.ts
git mv tests/commands/import.test.ts console/tests/commands/import.test.ts
git mv tests/commands/list.test.ts console/tests/commands/list.test.ts
git mv tests/commands/listall.test.ts console/tests/commands/listall.test.ts
git mv tests/commands/pri.test.ts console/tests/commands/pri.test.ts
git mv tests/commands/report.test.ts console/tests/commands/report.test.ts
git mv tests/commands/rm.test.ts console/tests/commands/rm.test.ts
git mv tests/commands/search.test.ts console/tests/commands/search.test.ts
rmdir tests/commands tests
```

- [ ] **Commit scaffold (tests are broken at this point — expected)**

```bash
git add -A
git commit -m "refactor: scaffold shared/ and console/ directories, move all files"
```

---

## Task 2: Create shared/utils.ts

Extract `addDays` from `console/output.ts` into `shared/utils.ts` so shared transforms can use it without importing from console/.

**Files:**
- Create: `shared/utils.ts`
- Modify: `console/output.ts`

- [ ] **Create shared/utils.ts**

```ts
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Update console/output.ts: replace the inline addDays function with a re-export**

Find the `addDays` function in `console/output.ts` (it's a small date utility, ~4 lines) and replace it with:

```ts
export { addDays } from '../shared/utils';
```

(Remove the function body — the re-export replaces it. Using `export` rather than `import` preserves all existing `import { addDays } from '../output'` statements in `console/commands/*.ts` without needing to touch them.)

- [ ] **Commit**

```bash
git add shared/utils.ts console/output.ts
git commit -m "refactor: extract addDays to shared/utils.ts"
```

---

## Task 3: Fix all broken import paths

All moved files still have their old relative import paths (`../parser`, `../store`, `../../src/parser`, etc.). Fix them all in one pass.

**Files:** All files in `console/` and `shared/`.

- [ ] **Fix imports in shared/parser.ts**

No external imports — nothing to fix.

- [ ] **Fix imports in shared/recurrence.ts**

Change `from '../parser'` → `from './parser'`

- [ ] **Fix imports in console/store.ts**

Change `from './parser'` → `from '../shared/parser'`

- [ ] **Fix imports in console/output.ts**

Change `from './parser'` → `from '../shared/parser'`

- [ ] **Fix imports in console/index.ts**

Change all `from './commands/X'` → `from './commands/X'` (same path, no change needed if already relative to console/).
Change `from './store'` → `from './store'` (no change).

- [ ] **Fix imports in all console/commands/*.ts**

For each file in `console/commands/`, update:
- `from '../parser'` → `from '../../shared/parser'`
- `from '../recurrence'` → `from '../../shared/recurrence'`
- `from '../store'` → `from '../store'`
- `from '../output'` → `from '../output'`
- `from './list'` → `from './list'` (no change; same directory)
- `from './focus'` → `from './focus'` (no change)

- [ ] **Fix imports in moved test files**

`shared/tests/parser.test.ts`:
```ts
// Change:
import { parseLine, serializeTask, baseText } from '../src/parser';
// To:
import { parseLine, serializeTask, baseText } from '../parser';
import type { Task } from '../parser';
```

`shared/tests/recurrence.test.ts`:
```ts
// Change:
import { validateFrequency } from '../src/recurrence';
// To:
import { validateFrequency } from '../recurrence';
```

`console/tests/store.test.ts`:
```ts
// Change:
import { readTasks, writeTasks, resolveFile } from '../src/store';
// To:
import { readTasks, writeTasks, resolveFile } from '../store';
```

All files in `console/tests/commands/*.test.ts` — change the CLI constant:
```ts
// Change:
const CLI = './src/index.ts';
// To:
const CLI = './console/index.ts';
```

- [ ] **Update tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true
  },
  "include": ["shared", "console"]
}
```

- [ ] **Update package.json**

```json
{
  "name": "todo",
  "version": "0.1.0",
  "module": "console/index.ts",
  "bin": {
    "todo": "./console/index.ts"
  },
  "scripts": {
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "dependencies": {
    "ical.js": "^2.2.1"
  }
}
```

- [ ] **Update todo.sh**

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bun run "$SCRIPT_DIR/console/index.ts" "$@"
```

- [ ] **Verify tests pass**

```bash
bun test
```

Expected: 309 pass, 0 fail (same as before the restructure).

- [ ] **Commit**

```bash
git add -A
git commit -m "refactor: fix all import paths after move to console/ and shared/"
```

---

## Task 4: Create shared/commands/list.ts

Move the pure query helpers out of `console/commands/list.ts` into `shared/commands/list.ts`. The console wrapper keeps the CLI arg parsing and I/O.

**Files:**
- Create: `shared/commands/list.ts`
- Modify: `console/commands/list.ts`
- Create: `shared/tests/commands/list.test.ts`

- [ ] **Write failing tests for the shared helpers**

Create `shared/tests/commands/list.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { matchesFilters, sortByPriority, isPastEvent, toJsonTask } from '../../commands/list';
import { parseLine } from '../../parser';

describe('matchesFilters', () => {
  test('matches project filter', () => {
    const t = parseLine('fix bug +backend', 1);
    expect(matchesFilters(t, ['+backend'])).toBe(true);
    expect(matchesFilters(t, ['+frontend'])).toBe(false);
  });

  test('matches context filter', () => {
    const t = parseLine('call dentist @phone', 1);
    expect(matchesFilters(t, ['@phone'])).toBe(true);
  });

  test('matches priority filter', () => {
    const t = parseLine('(A) urgent task', 1);
    expect(matchesFilters(t, ['(A)'])).toBe(true);
    expect(matchesFilters(t, ['(B)'])).toBe(false);
  });

  test('matches keyword filter case-insensitively', () => {
    const t = parseLine('Call Dentist', 1);
    expect(matchesFilters(t, ['dentist'])).toBe(true);
  });

  test('ANDs multiple filters', () => {
    const t = parseLine('fix bug +backend @work', 1);
    expect(matchesFilters(t, ['+backend', '@work'])).toBe(true);
    expect(matchesFilters(t, ['+backend', '@home'])).toBe(false);
  });
});

describe('sortByPriority', () => {
  test('sorts A before B before unprioritized', () => {
    const tasks = [
      parseLine('no priority', 1),
      parseLine('(B) medium', 2),
      parseLine('(A) urgent', 3),
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0]!.priority).toBe('A');
    expect(sorted[1]!.priority).toBe('B');
    expect(sorted[2]!.priority).toBeUndefined();
  });
});

describe('isPastEvent', () => {
  test('returns false for non-event tasks', () => {
    const t = parseLine('regular task start:2020-01-01', 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(false);
  });

  test('returns true for past one-time event', () => {
    const t = parseLine('party type:event start:2020-01-01', 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(true);
  });

  test('returns false for birthday (yearly, never past)', () => {
    const t = parseLine("Mom's birthday type:birthday start:1980-06-15 frequency:yearly", 1);
    expect(isPastEvent(t, '2026-05-23')).toBe(false);
  });
});
```

- [ ] **Run tests to verify they fail**

```bash
bun test shared/tests/commands/list.test.ts
```

Expected: fail — `shared/commands/list.ts` does not exist yet.

- [ ] **Create shared/commands/list.ts**

```ts
import type { Task } from '../parser';
import { baseText } from '../parser';

export type JsonTask = {
  line: number;
  done: boolean;
  completionDate: string | null;
  creationDate: string | null;
  priority: string | null;
  text: string;
  description: string;
  projects: string[];
  contexts: string[];
  extensions: Record<string, string>;
};

export function toJsonTask(task: Task): JsonTask {
  return {
    line: task.line,
    done: task.done,
    completionDate: task.completionDate ?? null,
    creationDate: task.creationDate ?? null,
    priority: task.priority ?? null,
    text: task.text,
    description: baseText(task.text),
    projects: task.projects,
    contexts: task.contexts,
    extensions: task.extensions,
  };
}

export function sortByPriority(tasks: Task[]): Task[] {
  const rank = (p: string | undefined) => p === undefined ? 26 : p.charCodeAt(0) - 65;
  return [...tasks].sort((a, b) => rank(a.priority) - rank(b.priority));
}

const YEARLY_TYPES = new Set(['anniversary', 'birthday']);

export function isPastEvent(task: Task, todayStr: string): boolean {
  if (!task.extensions['type']) return false;
  const start = task.extensions['start'];
  if (!start) return false;
  if (task.extensions['frequency']) {
    const until = task.extensions['recur-until'];
    return until !== undefined && until < todayStr;
  }
  if (YEARLY_TYPES.has(task.extensions['type']!)) return false;
  const end = task.extensions['end'];
  if (end) return end.slice(0, 10) < todayStr;
  return start.slice(0, 10) < todayStr;
}

export function matchesFilters(task: Task, filters: string[]): boolean {
  return filters.every(f => {
    if (f.startsWith('+')) return task.projects.includes(f);
    if (f.startsWith('@')) return task.contexts.includes(f);
    if (/^\([A-Z]\)$/.test(f)) return task.priority === f[1];
    return task.text.toLowerCase().includes(f.toLowerCase());
  });
}
```

- [ ] **Run tests to verify they pass**

```bash
bun test shared/tests/commands/list.test.ts
```

Expected: all pass.

- [ ] **Update console/commands/list.ts to import from shared**

Replace the definitions of `JsonTask`, `toJsonTask`, `sortByPriority`, `isPastEvent`, `matchesFilters` with imports:

```ts
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatTask, formatSummary } from '../output';
import { matchesFilters, sortByPriority, isPastEvent, toJsonTask } from '../../shared/commands/list';
import type { JsonTask } from '../../shared/commands/list';
export { matchesFilters, sortByPriority, isPastEvent, toJsonTask };
export type { JsonTask };
```

Keep `parseListArgs` and `listCommand` in `console/commands/list.ts` unchanged (they are CLI-specific).

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/list.ts shared/tests/commands/list.test.ts console/commands/list.ts
git commit -m "refactor: extract matchesFilters/sortByPriority/isPastEvent/toJsonTask to shared/commands/list"
```

---

## Task 5: Create shared/commands/focus.ts

Move all focus helpers and the `applyFocus` pure transform to shared. The console wrapper becomes a thin orchestrator.

**Files:**
- Create: `shared/commands/focus.ts`
- Modify: `console/commands/focus.ts`

- [ ] **Create shared/commands/focus.ts**

This file contains every function from the current `console/commands/focus.ts` except `focusCommand`. The `focusCommand` stays in the console wrapper. Replace all `import { addDays }` references with `shared/utils`.

```ts
import { addDays } from '../utils';
import type { Task } from '../parser';
import { baseText } from '../parser';
import { isPastEvent } from './list';

// ── Internal helpers ────────────────────────────────────────────────────────

const POSITIONAL_POSITIONS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const POSITIONAL_DAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

function matchesDayType(dow: number, dayType: string): boolean {
  if (dayType === 'weekend-day') return dow === 0 || dow === 6;
  if (dayType === 'weekday') return dow >= 1 && dow <= 5;
  if (dayType === 'day') return true;
  return dow === (POSITIONAL_DAYS[dayType] ?? -1);
}

function resolvePositionalDay(year: number, month: number, positionalDay: string): number {
  const dashIdx = positionalDay.indexOf('-');
  const position = positionalDay.slice(0, dashIdx);
  const dayType = positionalDay.slice(dashIdx + 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (position === 'last') {
    for (let d = daysInMonth; d >= 1; d--) {
      if (matchesDayType(new Date(year, month, d).getDay(), dayType)) return d;
    }
    return daysInMonth;
  }
  const count = POSITIONAL_POSITIONS[position] ?? 1;
  let found = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    if (matchesDayType(new Date(year, month, d).getDay(), dayType)) {
      if (++found === count) return d;
    }
  }
  return 1;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function taskExdates(task: Task): Set<string> {
  return new Set((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
}

// ── Exported date helpers (used by done.ts, skip.ts) ────────────────────────

export function nextYearlyDate(start: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
  const month0 = parseInt(start.slice(5, 7)) - 1;
  const thisYear = parseInt(todayStr.slice(0, 4));

  function occurrenceForYear(year: number): string {
    if (frequencyMonthDay && isNaN(Number(frequencyMonthDay))) {
      const day = resolvePositionalDay(year, month0, frequencyMonthDay);
      return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${year}-${start.slice(5, 10)}`;
  }

  const thisOccurrence = occurrenceForYear(thisYear);
  const result = thisOccurrence >= todayStr ? thisOccurrence : occurrenceForYear(thisYear + 1);
  if (exdates.has(result)) return nextYearlyDate(start, addDays(result, 1), exdates, frequencyMonthDay);
  return result;
}

const FREQ_DAY_DOW: Record<string, number> = { Sun: 0, M: 1, T: 2, W: 3, Th: 4, F: 5, Sat: 6 };

export function nextWeeklyDate(startStr: string, todayStr: string, every: number = 1, exdates: Set<string> = new Set(), frequencyDay?: string): string {
  if (frequencyDay) {
    const dows = new Set(frequencyDay.split(',').map(d => FREQ_DAY_DOW[d]).filter((d): d is number => d !== undefined));
    if (every === 1) {
      for (let i = 0; i <= 7; i++) {
        const d = new Date(todayStr + 'T12:00:00');
        d.setDate(d.getDate() + i);
        if (dows.has(d.getDay())) {
          const dateStr = isoDate(d);
          if (exdates.has(dateStr)) return nextWeeklyDate(startStr, addDays(dateStr, 1), every, exdates, frequencyDay);
          return dateStr;
        }
      }
    } else {
      const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
      const todayDate = new Date(todayStr + 'T12:00:00');
      const diffDays = Math.round((todayDate.getTime() - startDate.getTime()) / 86400000);
      const intervalDays = every * 7;
      const startCycle = diffDays <= 0 ? 0 : Math.floor(diffDays / intervalDays);
      for (let cycle = startCycle; cycle <= startCycle + 2; cycle++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + cycle * intervalDays);
        for (let offset = 0; offset < intervalDays; offset++) {
          const candidate = new Date(weekStart);
          candidate.setDate(weekStart.getDate() + offset);
          if (candidate < todayDate) continue;
          if (dows.has(candidate.getDay())) {
            const dateStr = isoDate(candidate);
            if (exdates.has(dateStr)) continue;
            return dateStr;
          }
        }
      }
    }
    return startStr.slice(0, 10);
  }

  const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
  const todayDate = new Date(todayStr + 'T12:00:00');
  const intervalDays = every * 7;
  const diffDays = Math.round((todayDate.getTime() - startDate.getTime()) / 86400000);
  let result: string;
  if (diffDays <= 0) {
    result = startStr.slice(0, 10);
  } else {
    const cycles = Math.ceil(diffDays / intervalDays);
    const next = new Date(startDate);
    next.setDate(startDate.getDate() + cycles * intervalDays);
    result = isoDate(next);
  }
  if (exdates.has(result)) return nextWeeklyDate(startStr, addDays(result, 1), every, exdates);
  return result;
}

export function nextMonthlyDate(startStr: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
  const t = new Date(todayStr + 'T12:00:00');

  function dayForMonth(year: number, month: number): number {
    const fmd = frequencyMonthDay ?? startStr.slice(8, 10);
    if (isNaN(Number(fmd))) return resolvePositionalDay(year, month, fmd);
    return parseInt(fmd);
  }

  let year = t.getFullYear();
  let month = t.getMonth();
  let candidate = new Date(year, month, dayForMonth(year, month));
  if (candidate < t) {
    month++;
    if (month > 11) { month = 0; year++; }
    candidate = new Date(year, month, dayForMonth(year, month));
  }
  const result = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
  if (exdates.has(result)) return nextMonthlyDate(startStr, addDays(result, 1), exdates, frequencyMonthDay);
  return result;
}

// ── Focus-specific helpers ───────────────────────────────────────────────────

function overdueOccurrenceDate(task: Task, todayStr: string): string | null {
  if (task.done || task.extensions['type']) return null;
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const lastDone = task.extensions['last-done'];
  if (!start || !frequency) return null;
  const startDate = start.slice(0, 10);
  const exdates = taskExdates(task);
  let prev: string | null = null;

  if (frequency === 'weekly' && !task.extensions['frequency-day']) {
    const everyN = parseInt(task.extensions['every'] ?? '1');
    const cycleDays = everyN * 7;
    const startD = new Date(startDate + 'T12:00:00');
    const todayD = new Date(todayStr + 'T12:00:00');
    const diffDays = Math.round((todayD.getTime() - startD.getTime()) / 86400000);
    if (diffDays <= 0) return null;
    const d = new Date(startD);
    d.setDate(startD.getDate() + Math.floor(diffDays / cycleDays) * cycleDays);
    prev = isoDate(d);
    while (prev && exdates.has(prev)) {
      const pd = new Date(prev + 'T12:00:00');
      pd.setDate(pd.getDate() - cycleDays);
      const p = isoDate(pd);
      prev = p >= startDate ? p : null;
    }
    if (prev && prev < addDays(todayStr, -(cycleDays - 1))) return null;
    if (prev && lastDone && lastDone > addDays(prev, -cycleDays)) return null;
  } else if (frequency === 'monthly') {
    const fmd = task.extensions['frequency-month-day'];
    const t = new Date(todayStr + 'T12:00:00');
    function dayForMonth(year: number, month: number): number {
      const val = fmd ?? startDate.slice(8, 10);
      if (isNaN(Number(val))) return resolvePositionalDay(year, month, val);
      return parseInt(val);
    }
    const year = t.getFullYear();
    const month = t.getMonth();
    const dayOfMonth = dayForMonth(year, month);
    const currCandidate = new Date(year, month, dayOfMonth);
    if (currCandidate > t) return null;
    const candStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    if (!exdates.has(candStr)) prev = candStr;
  } else {
    return null;
  }

  if (!prev || prev < startDate || prev > todayStr) return null;
  if (lastDone && lastDone >= prev) return null;
  return prev;
}

function isInFocusWindow(task: Task, todayStr: string, windowEnd: string): boolean {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const exdates = taskExdates(task);

  if (type) {
    if (!start) return false;
    if (frequency === 'yearly') {
      const next = nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
      return next >= todayStr && next <= windowEnd;
    }
    if (frequency === 'monthly') {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) <= windowEnd;
    }
    if (frequency) {
      const startDate = start.slice(0, 10);
      if (startDate < addDays(todayStr, -730)) return false;
      return true;
    }
    const startDate = start.slice(0, 10);
    const endDate = (task.extensions['end'] ?? start).slice(0, 10);
    return startDate <= windowEnd && endDate >= todayStr;
  }

  if (start && frequency) {
    const startDate = start.slice(0, 10);
    if (startDate < addDays(todayStr, -730)) return false;
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']) <= windowEnd;
    if (frequency === 'monthly') {
      const next = nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']);
      return next <= windowEnd || overdueOccurrenceDate(task, todayStr) !== null;
    }
    return startDate <= windowEnd;
  }

  if (start) return start.slice(0, 10) <= windowEnd;

  const due = task.extensions['due'];
  if (!due) return false;
  return due.slice(0, 10) <= windowEnd;
}

export function focusSortKey(task: Task, todayStr: string): string {
  const type = task.extensions['type'];
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  const time = start ? start.slice(10) : '';
  const exdates = taskExdates(task);

  if (type && start) {
    if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
    if (frequency === 'weekly') return nextWeeklyDate(start, todayStr, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']) + time;
    if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
    if (frequency) return todayStr + time;
    if (start.slice(0, 10) < todayStr) {
      const end = task.extensions['end'];
      if (end && end.slice(0, 10) >= todayStr) return todayStr + time;
    }
    return start.slice(0, 16);
  }

  if (start && frequency) {
    const time = start.slice(10);
    if (frequency === 'weekly') {
      if (overdueOccurrenceDate(task, todayStr)) return todayStr + time;
      const everyN = parseInt(task.extensions['every'] ?? '1');
      const currentOcc = nextWeeklyDate(start, todayStr, everyN, exdates, task.extensions['frequency-day']);
      const lastDone = task.extensions['last-done'];
      if (lastDone && lastDone > addDays(currentOcc, -(everyN * 7))) {
        return nextWeeklyDate(start, addDays(currentOcc, 1), everyN, exdates, task.extensions['frequency-day']) + time;
      }
      return currentOcc + time;
    }
    if (frequency === 'monthly') {
      if (overdueOccurrenceDate(task, todayStr)) return todayStr + time;
      return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
    }
    if (frequency === 'daily') {
      const startDate = start.slice(0, 10);
      let d = startDate > todayStr ? startDate : todayStr;
      while (exdates.has(d)) d = addDays(d, 1);
      return d + time;
    }
    const startDate = start.slice(0, 10);
    return (startDate > todayStr ? startDate : todayStr) + time;
  }

  if (start) return start.slice(0, 16);

  const due = task.extensions['due'];
  if (due) return due;
  return '9999-12-31';
}

// ── Recurrence label builder ─────────────────────────────────────────────────

const REC_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function focusNextRecurrence(task: Task, todayStr: string): string {
  const start = task.extensions['start'];
  const frequency = task.extensions['frequency'];
  if (!start || !frequency) return '';

  const exdates = taskExdates(task);
  const currentDate = focusSortKey(task, todayStr).slice(0, 10);
  const afterCurrent = addDays(currentDate, 1);
  const time = start.length > 10 ? start.slice(11, 16) : '';

  let nextDate: string;
  if (frequency === 'weekly') nextDate = nextWeeklyDate(start, afterCurrent, parseInt(task.extensions['every'] ?? '1'), exdates, task.extensions['frequency-day']);
  else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent, exdates, task.extensions['frequency-month-day']);
  else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent, exdates, task.extensions['frequency-month-day']);
  else if (frequency === 'daily') nextDate = afterCurrent;
  else return '';

  const d = new Date(nextDate + 'T12:00:00');
  const showDay = frequency === 'weekly' || frequency === 'daily';
  const dayPart = showDay ? `${REC_DAY[d.getDay()]} ` : '';
  const monthDay = `${REC_MON[d.getMonth()]} ${d.getDate()}`;
  const yearPart = nextDate.slice(0, 4) !== todayStr.slice(0, 4) ? ` ${d.getFullYear()}` : '';
  return `↻ ${dayPart}${monthDay}${yearPart}${time ? ' ' + time : ''}`;
}

// ── Streak computation ───────────────────────────────────────────────────────

function stepBack(date: string, freq: string, every = '1'): string {
  if (freq === 'weekly') return addDays(date, -(parseInt(every) * 7));
  if (freq === 'monthly') {
    const d = new Date(date + 'T12:00:00');
    const targetMonth = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
    const targetYear = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const day = Math.min(d.getDate(), lastDay);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') return `${parseInt(date.slice(0, 4)) - 1}-${date.slice(5)}`;
  return addDays(date, -1);
}

export function computeStreak(task: Task, allTasks: Task[], todayStr: string): number {
  const freq = task.extensions['frequency'];
  if (!freq) return 0;
  const base = baseText(task.text);
  const dates = new Set<string>(
    allTasks
      .filter(t => t.done && t.completionDate && baseText(t.text) === base)
      .map(t => t.completionDate!)
  );
  if (dates.size === 0) return 0;
  const mostRecent = [...dates].sort().at(-1)!;
  if (mostRecent < stepBack(todayStr, freq, task.extensions['every'])) return 0;
  let streak = 0;
  let check = mostRecent;
  while (dates.has(check)) {
    streak++;
    check = stepBack(check, freq, task.extensions['every']);
  }
  return streak;
}

// ── Public transform ─────────────────────────────────────────────────────────

export type FocusItem = {
  task: Task;
  effectiveDate: string;
  recurrenceLabel: string;
  streak: number;
};

export function applyFocus(tasks: Task[], todayStr: string): FocusItem[] {
  const windowEnd = addDays(todayStr, 14);

  const effToday = (t: Task): string => {
    if (t.done) return addDays(t.completionDate ?? todayStr, 1);
    const lastDone = t.extensions['last-done'];
    if (lastDone === todayStr) {
      const start = t.extensions['start'];
      const freq = t.extensions['frequency'];
      const every = t.extensions['every'] ?? '1';
      if (start && freq) {
        const exdates = taskExdates(t);
        if (freq === 'weekly') return addDays(nextWeeklyDate(start, todayStr, parseInt(every), exdates, t.extensions['frequency-day']), 1);
        if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr, exdates, t.extensions['frequency-month-day']), 1);
        if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr, exdates, t.extensions['frequency-month-day']), 1);
      }
      return addDays(todayStr, 1);
    }
    return todayStr;
  };

  const relevant = tasks.filter(t => {
    if (t.done) {
      const freq = t.extensions['frequency'];
      const start = t.extensions['start'];
      if (!(freq && start)) return false;
      const recurUntil = t.extensions['recur-until'];
      if (recurUntil && recurUntil < addDays(t.completionDate ?? todayStr, 1)) return false;
      return true;
    }
    return !isPastEvent(t, todayStr);
  });

  const focused = relevant.filter(t => isInFocusWindow(t, effToday(t), windowEnd));

  focused.sort((a, b) => {
    const da = focusSortKey(a, effToday(a));
    const db = focusSortKey(b, effToday(b));
    if (da !== db) return da.localeCompare(db);
    return (a.priority ?? 'Z').localeCompare(b.priority ?? 'Z');
  });

  return focused.map(t => {
    const et = effToday(t);
    return {
      task: t,
      effectiveDate: focusSortKey(t, et),
      recurrenceLabel: focusNextRecurrence(t, et),
      streak: t.extensions['frequency'] ? computeStreak(t, tasks, todayStr) : 0,
    };
  });
}
```

- [ ] **Update console/commands/focus.ts to be a thin wrapper**

Replace the entire file content with:

```ts
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, addDays, formatFocusTask } from '../output';
import { applyFocus } from '../../shared/commands/focus';
export { nextWeeklyDate, nextMonthlyDate, nextYearlyDate, focusSortKey } from '../../shared/commands/focus';

export function focusCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }
  const todayStr = today();
  const tasks = readTasks(filePath);
  const items = applyFocus(tasks, todayStr);

  if (items.length === 0) {
    console.log(`\x1b[2mNothing in focus for the next 2 weeks.\x1b[0m`);
    return;
  }

  const windowEnd = addDays(todayStr, 14);
  items.forEach(({ task, effectiveDate, recurrenceLabel, streak }) => {
    console.log(formatFocusTask(task, todayStr, effectiveDate, recurrenceLabel, streak));
  });
  console.log(`\x1b[2m${items.length} item${items.length === 1 ? '' : 's'} in focus (${todayStr} – ${windowEnd})\x1b[0m`);
}
```

Note: `console/commands/done.ts` and `console/commands/skip.ts` currently import `nextWeeklyDate`, `nextMonthlyDate`, `focusSortKey` from `./focus`. They will continue to work because `console/commands/focus.ts` re-exports those from shared.

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/focus.ts console/commands/focus.ts
git commit -m "refactor: extract focus logic to shared/commands/focus; console wrapper calls applyFocus"
```

---

## Task 6: Create shared/commands/done.ts

**Files:**
- Create: `shared/commands/done.ts`
- Modify: `console/commands/done.ts`
- Create: `shared/tests/commands/done.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/done.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { applyDone } from '../../commands/done';
import { parseLine } from '../../parser';

function makeTask(raw: string, line = 1) { return parseLine(raw, line); }

describe('applyDone', () => {
  test('marks a plain task done', () => {
    const tasks = [makeTask('call dentist')];
    const { tasks: updated, completed } = applyDone(tasks, [1], '2026-05-23');
    expect(completed).toHaveLength(1);
    expect(updated[0]!.done).toBe(true);
    expect(updated[0]!.completionDate).toBe('2026-05-23');
  });

  test('throws for unknown line number', () => {
    const tasks = [makeTask('call dentist')];
    expect(() => applyDone(tasks, [99], '2026-05-23')).toThrow('no task #99');
  });

  test('skips already-done task', () => {
    const tasks = [makeTask('x 2026-05-22 call dentist')];
    const { tasks: updated, completed } = applyDone(tasks, [1], '2026-05-23');
    expect(completed).toHaveLength(0);
    expect(updated[0]!.done).toBe(true);
  });

  test('creates recurrence copy for weekly task and advances start', () => {
    const tasks = [makeTask('mow lawn start:2026-05-22T09:00 frequency:weekly')];
    const { tasks: updated, copies } = applyDone(tasks, [1], '2026-05-23');
    expect(copies).toHaveLength(1);
    expect(copies[0]!.done).toBe(true);
    // Original advances start by 7 days
    expect(updated[0]!.extensions['start']).toBe('2026-05-29T09:00');
  });
});
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/done.test.ts
```

Expected: fail — `shared/commands/done.ts` does not exist.

- [ ] **Create shared/commands/done.ts**

```ts
import { serializeTask, baseText } from '../parser';
import type { Task } from '../parser';
import { addDays } from '../utils';
import { nextWeeklyDate, nextMonthlyDate } from './focus';

export function applyDone(
  tasks: Task[],
  nums: number[],
  todayStr: string,
): { tasks: Task[]; completed: Task[]; copies: Task[] } {
  const completed: Task[] = [];
  const copies: Task[] = [];

  for (const n of nums) {
    const task = tasks.find(t => t.line === n);
    if (!task) throw new Error(`no task #${n}`);

    const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);

    if (isRecurring) {
      const lastDone = task.extensions['last-done'];
      const alreadyToday = lastDone === todayStr || (task.done && task.completionDate === todayStr);
      if (alreadyToday) continue;

      const copyText = baseText(task.text);
      const copyRaw = ['x', todayStr, ...(task.creationDate ? [task.creationDate] : []), copyText].join(' ');
      const copy: Task = {
        line: 0,
        raw: copyRaw,
        done: true,
        completionDate: todayStr,
        creationDate: task.creationDate,
        text: copyText,
        projects: task.projects,
        contexts: task.contexts,
        extensions: {},
      };

      if (task.done) {
        task.done = false;
        task.completionDate = undefined;
        task.priority = undefined;
      }

      const hasLastDone = /(?:^|\s)last-done:[^/\s]\S*/.test(task.text);
      if (hasLastDone) {
        task.text = task.text.replace(/\blast-done:[^/\s]\S*/g, `last-done:${todayStr}`);
      } else {
        task.text = `${task.text} last-done:${todayStr}`;
      }
      task.extensions['last-done'] = todayStr;

      const startVal = task.extensions['start'];
      const freq = task.extensions['frequency'];
      if (startVal && (freq === 'weekly' || freq === 'monthly')) {
        const every = parseInt(task.extensions['every'] ?? '1');
        const exdates = new Set<string>((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
        const freqDay = task.extensions['frequency-day'];
        const freqMonthDay = task.extensions['frequency-month-day'];
        const currentOcc = freq === 'weekly'
          ? nextWeeklyDate(startVal, todayStr, every, exdates, freqDay)
          : nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay);
        const nextOcc = freq === 'weekly'
          ? nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay)
          : nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay);
        const timePart = startVal.slice(10);
        const newStart = nextOcc + timePart;
        task.text = task.text.replace(/\bstart:\S+/g, `start:${newStart}`);
        task.extensions['start'] = newStart;
      }

      task.raw = serializeTask(task);
      tasks.push(copy);
      completed.push(task);
      copies.push(copy);
      continue;
    }

    if (task.done) continue;
    task.done = true;
    task.completionDate = todayStr;
    task.priority = undefined;
    task.raw = serializeTask(task);
    completed.push(task);
  }

  return { tasks, completed, copies };
}
```

- [ ] **Update console/commands/done.ts to be a thin wrapper**

```ts
import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyDone } from '../../shared/commands/done';

export function doneCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo done <n> [n...]');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const todayStr = today();

  let result: ReturnType<typeof applyDone>;
  try {
    result = applyDone(tasks, nums, todayStr);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  const { tasks: updated, completed } = result;
  if (completed.length > 0) {
    writeTasks(filePath, updated);
    for (const t of completed) console.log(`Done: ${formatTask(t, todayStr)}`);
  }
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/done.ts shared/tests/commands/done.test.ts console/commands/done.ts
git commit -m "refactor: extract applyDone to shared/commands/done"
```

---

## Task 7: Create shared/commands/skip.ts

**Files:**
- Create: `shared/commands/skip.ts`
- Modify: `console/commands/skip.ts`

- [ ] **Create shared/commands/skip.ts**

```ts
import { serializeTask } from '../parser';
import type { Task } from '../parser';
import { focusSortKey } from './focus';

export function applySkip(
  tasks: Task[],
  lineNum: number,
  todayStr: string,
): { tasks: Task[]; skippedDate: string; nextDate: string } {
  const task = tasks.find(t => t.line === lineNum);
  if (!task) throw new Error(`task #${lineNum} not found`);
  if (!task.extensions['frequency']) throw new Error(`task #${lineNum} is not recurring`);

  const skipDate = focusSortKey(task, todayStr).slice(0, 10);

  const existing = task.extensions['exdate'] ?? '';
  const exdateList = existing.split(',').filter(Boolean);
  if (exdateList.includes(skipDate)) {
    return { tasks, skippedDate: skipDate, nextDate: skipDate };
  }
  exdateList.push(skipDate);
  exdateList.sort();
  const newExdate = exdateList.join(',');

  if (existing) {
    task.text = task.text.replace(/(?:^|\s)exdate:\S+/, ` exdate:${newExdate}`).trimStart();
  } else {
    task.text += ` exdate:${newExdate}`;
  }
  task.extensions['exdate'] = newExdate;
  task.raw = serializeTask(task);

  const nextDate = focusSortKey(task, todayStr).slice(0, 10);
  return { tasks, skippedDate: skipDate, nextDate };
}
```

- [ ] **Update console/commands/skip.ts to be a thin wrapper**

```ts
import { existsSync } from 'fs';
import { readTasks, writeTasks } from '../store';
import { today } from '../output';
import { applySkip } from '../../shared/commands/skip';

export function skipCommand(filePath: string, lineArg: string | undefined): void {
  if (!lineArg) {
    console.error('Usage: todo skip <n>');
    process.exit(1);
  }
  const lineNum = parseInt(lineArg);
  if (isNaN(lineNum)) {
    console.error(`todo: invalid task number '${lineArg}'`);
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error("No todo.txt found. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);

  let result: ReturnType<typeof applySkip>;
  try {
    result = applySkip(tasks, lineNum, todayStr);
  } catch (e) {
    console.error(`todo: ${(e as Error).message}`);
    process.exit(1);
  }

  const { tasks: updated, skippedDate, nextDate } = result;
  if (skippedDate === nextDate) {
    console.log(`Already skipping ${skippedDate} for #${lineNum}.`);
    return;
  }
  writeTasks(filePath, updated);
  console.log(`Skipped ${skippedDate}: #${lineNum} next shows ${nextDate}`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/skip.ts console/commands/skip.ts
git commit -m "refactor: extract applySkip to shared/commands/skip"
```

---

## Task 8: Create shared/commands/add.ts

**Files:**
- Create: `shared/commands/add.ts`
- Modify: `console/commands/add.ts`
- Create: `shared/tests/commands/add.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/add.test.ts`:

```ts
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
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/add.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/add.ts**

```ts
import { validateFrequency } from '../recurrence';

export function buildAddRaw(text: string, todayStr: string): string {
  validateFrequency(text);
  const priorityMatch = text.match(/^\(([A-Z])\)\s+/);
  if (priorityMatch) {
    const rest = text.slice(priorityMatch[0].length);
    return `(${priorityMatch[1]}) ${todayStr} ${rest}`;
  }
  return `${todayStr} ${text}`;
}
```

- [ ] **Run tests to verify pass**

```bash
bun test shared/tests/commands/add.test.ts
```

Expected: all pass.

- [ ] **Update console/commands/add.ts to be a thin wrapper**

```ts
import { appendFileSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { buildAddRaw } from '../../shared/commands/add';

export function addCommand(filePath: string, textParts: string[]): void {
  if (textParts.length === 0) {
    console.error('Usage: todo add <text>');
    process.exit(1);
  }

  const text = textParts.join(' ');
  const todayStr = today();

  let raw: string;
  try {
    raw = buildAddRaw(text, todayStr);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  appendFileSync(filePath, raw + '\n', 'utf8');

  const tasks = readTasks(filePath);
  const added = tasks[tasks.length - 1]!;
  console.log(`Added: ${formatTask(added, todayStr)}`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/add.ts shared/tests/commands/add.test.ts console/commands/add.ts
git commit -m "refactor: extract buildAddRaw to shared/commands/add"
```

---

## Task 9: Create shared/commands/rm.ts

**Files:**
- Create: `shared/commands/rm.ts`
- Modify: `console/commands/rm.ts`
- Create: `shared/tests/commands/rm.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/rm.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { applyRm } from '../../commands/rm';
import { parseLine } from '../../parser';

describe('applyRm', () => {
  test('removes a single task', () => {
    const tasks = [parseLine('task one', 1), parseLine('task two', 2)];
    const { tasks: updated, removed, missing } = applyRm(tasks, [1]);
    expect(updated).toHaveLength(1);
    expect(removed).toEqual(['task one']);
    expect(missing).toHaveLength(0);
  });

  test('removes multiple tasks and re-indexes', () => {
    const tasks = [parseLine('a', 1), parseLine('b', 2), parseLine('c', 3)];
    const { tasks: updated } = applyRm(tasks, [1, 2]);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.line).toBe(1);
  });

  test('collects missing line numbers', () => {
    const tasks = [parseLine('task one', 1)];
    const { missing, removed } = applyRm(tasks, [99]);
    expect(missing).toEqual([99]);
    expect(removed).toHaveLength(0);
  });
});
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/rm.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/rm.ts**

```ts
import type { Task } from '../parser';

export function applyRm(
  tasks: Task[],
  nums: number[],
): { tasks: Task[]; removed: string[]; missing: number[] } {
  const removed: string[] = [];
  const missing: number[] = [];

  for (const n of nums) {
    const idx = tasks.findIndex(t => t.line === n);
    if (idx === -1) {
      missing.push(n);
    } else {
      removed.push(tasks[idx]!.raw);
      tasks.splice(idx, 1);
      for (let i = idx; i < tasks.length; i++) tasks[i]!.line = i + 1;
    }
  }

  return { tasks, removed, missing };
}
```

- [ ] **Update console/commands/rm.ts to be a thin wrapper**

```ts
import { readTasks, writeTasks } from '../store';
import { applyRm } from '../../shared/commands/rm';

export function rmCommand(filePath: string, nStrs: string[]): void {
  if (nStrs.length === 0) {
    console.error('Usage: todo rm <n> [n...]');
    process.exit(1);
  }

  const nums = nStrs.map(s => parseInt(s, 10));
  if (nums.some(isNaN)) {
    console.error('Usage: todo rm <n> [n...]');
    process.exit(1);
  }

  const tasks = readTasks(filePath);
  const { tasks: updated, removed, missing } = applyRm(tasks, nums);

  if (missing.length > 0) {
    for (const n of missing) console.error(`Error: no task #${n}`);
    if (removed.length === 0) process.exit(1);
  }

  writeTasks(filePath, updated);
  for (const raw of removed) console.log(`Deleted: ${raw}`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/rm.ts shared/tests/commands/rm.test.ts console/commands/rm.ts
git commit -m "refactor: extract applyRm to shared/commands/rm"
```

---

## Task 10: Create shared/commands/edit.ts

**Files:**
- Create: `shared/commands/edit.ts`
- Modify: `console/commands/edit.ts`
- Create: `shared/tests/commands/edit.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/edit.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { applyEdit } from '../../commands/edit';
import { parseLine } from '../../parser';

describe('applyEdit', () => {
  test('replaces task text and preserves creation date', () => {
    const tasks = [parseLine('2026-01-01 old text', 1)];
    const { updated } = applyEdit(tasks, 1, 'new text', '2026-05-23');
    expect(updated.text).toBe('new text');
    expect(updated.creationDate).toBe('2026-01-01');
  });

  test('throws for unknown line number', () => {
    expect(() => applyEdit([], 99, 'text', '2026-05-23')).toThrow('no task #99');
  });

  test('throws when editing a completed task', () => {
    const tasks = [parseLine('x 2026-05-22 done task', 1)];
    expect(() => applyEdit(tasks, 1, 'new text', '2026-05-23')).toThrow('cannot edit completed task #1');
  });

  test('allows updating priority via edit', () => {
    const tasks = [parseLine('old task', 1)];
    const { updated } = applyEdit(tasks, 1, '(B) new task', '2026-05-23');
    expect(updated.priority).toBe('B');
    expect(updated.text).toBe('new task');
  });
});
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/edit.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/edit.ts**

```ts
import { parseLine, serializeTask } from '../parser';
import type { Task } from '../parser';
import { validateFrequency } from '../recurrence';

export function applyEdit(
  tasks: Task[],
  n: number,
  newText: string,
  todayStr: string,
): { tasks: Task[]; updated: Task } {
  validateFrequency(newText);

  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (task.done) throw new Error(`cannot edit completed task #${n}`);

  const creationDate = task.creationDate ?? todayStr;
  let syntheticRaw: string;
  const priorityMatch = newText.match(/^\(([A-Z])\)\s+/);
  if (priorityMatch) {
    const rest = newText.slice(priorityMatch[0].length);
    syntheticRaw = `(${priorityMatch[1]}) ${creationDate} ${rest}`;
  } else {
    syntheticRaw = `${creationDate} ${newText}`;
  }

  const parsed = parseLine(syntheticRaw, task.line);
  task.priority = parsed.priority;
  task.text = parsed.text;
  task.projects = parsed.projects;
  task.contexts = parsed.contexts;
  task.extensions = parsed.extensions;
  task.raw = serializeTask(task);

  return { tasks, updated: task };
}
```

- [ ] **Update console/commands/edit.ts to be a thin wrapper**

```ts
import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyEdit } from '../../shared/commands/edit';

export function editCommand(filePath: string, nStr: string | undefined, textParts: string[]): void {
  if (!nStr || textParts.length === 0) {
    console.error('Usage: todo edit <n> <new text>');
    process.exit(1);
  }

  const n = parseInt(nStr, 10);
  if (isNaN(n)) {
    console.error('Usage: todo edit <n> <new text>');
    process.exit(1);
  }

  const newText = textParts.join(' ');
  const tasks = readTasks(filePath);
  const todayStr = today();

  let result: ReturnType<typeof applyEdit>;
  try {
    result = applyEdit(tasks, n, newText, todayStr);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  writeTasks(filePath, result.tasks);
  console.log(`Updated: ${formatTask(result.updated, todayStr)}`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/edit.ts shared/tests/commands/edit.test.ts console/commands/edit.ts
git commit -m "refactor: extract applyEdit to shared/commands/edit"
```

---

## Task 11: Create shared/commands/pri.ts

**Files:**
- Create: `shared/commands/pri.ts`
- Modify: `console/commands/pri.ts`
- Create: `shared/tests/commands/pri.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/pri.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { applyPri, applyDepri } from '../../commands/pri';
import { parseLine } from '../../parser';

describe('applyPri', () => {
  test('sets priority on a task', () => {
    const tasks = [parseLine('call dentist', 1)];
    const { updated } = applyPri(tasks, 1, 'A');
    expect(updated.priority).toBe('A');
    expect(updated.raw.startsWith('(A)')).toBe(true);
  });

  test('throws for unknown task', () => {
    expect(() => applyPri([], 99, 'A')).toThrow('no task #99');
  });

  test('throws for completed task', () => {
    const tasks = [parseLine('x 2026-05-22 done', 1)];
    expect(() => applyPri(tasks, 1, 'A')).toThrow('cannot set priority on completed task #1');
  });
});

describe('applyDepri', () => {
  test('removes priority from a task', () => {
    const tasks = [parseLine('(B) call dentist', 1)];
    const { updated } = applyDepri(tasks, 1);
    expect(updated.priority).toBeUndefined();
  });

  test('throws when task has no priority', () => {
    const tasks = [parseLine('call dentist', 1)];
    expect(() => applyDepri(tasks, 1)).toThrow('no priority');
  });
});
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/pri.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/pri.ts**

```ts
import { serializeTask } from '../parser';
import type { Task } from '../parser';

export function applyPri(
  tasks: Task[],
  n: number,
  priority: string,
): { tasks: Task[]; updated: Task } {
  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (task.done) throw new Error(`cannot set priority on completed task #${n}`);

  task.priority = priority.toUpperCase();
  task.raw = serializeTask(task);
  return { tasks, updated: task };
}

export function applyDepri(
  tasks: Task[],
  n: number,
): { tasks: Task[]; updated: Task } {
  const task = tasks.find(t => t.line === n);
  if (!task) throw new Error(`no task #${n}`);
  if (!task.priority) throw new Error(`task #${n} has no priority`);

  task.priority = undefined;
  task.raw = serializeTask(task);
  return { tasks, updated: task };
}
```

- [ ] **Update console/commands/pri.ts to be a thin wrapper**

```ts
import { readTasks, writeTasks } from '../store';
import { today, formatTask } from '../output';
import { applyPri, applyDepri } from '../../shared/commands/pri';

export function priCommand(filePath: string, nStr: string | undefined, priStr: string | undefined): void {
  if (!nStr || !priStr) { console.error('Usage: todo pri <n> <A-Z>'); process.exit(1); }
  const n = parseInt(nStr, 10);
  if (isNaN(n)) { console.error('Usage: todo pri <n> <A-Z>'); process.exit(1); }
  const p = priStr.toUpperCase();
  if (!/^[A-Z]$/.test(p)) { console.error('Usage: todo pri <n> <A-Z>'); process.exit(1); }

  const tasks = readTasks(filePath);
  let result: ReturnType<typeof applyPri>;
  try {
    result = applyPri(tasks, n, p);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }
  writeTasks(filePath, result.tasks);
  console.log(`Priority set: ${formatTask(result.updated, today())}`);
}

export function depriCommand(filePath: string, nStr: string | undefined): void {
  if (!nStr) { console.error('Usage: todo depri <n>'); process.exit(1); }
  const n = parseInt(nStr, 10);
  if (isNaN(n)) { console.error('Usage: todo depri <n>'); process.exit(1); }

  const tasks = readTasks(filePath);
  let result: ReturnType<typeof applyDepri>;
  try {
    result = applyDepri(tasks, n);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('no priority')) { console.log(`Task #${n} has no priority.`); return; }
    console.error(`Error: ${msg}`);
    process.exit(1);
  }
  writeTasks(filePath, result.tasks);
  console.log(`Priority removed: ${formatTask(result.updated, today())}`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/pri.ts shared/tests/commands/pri.test.ts console/commands/pri.ts
git commit -m "refactor: extract applyPri/applyDepri to shared/commands/pri"
```

---

## Task 12: Create shared/commands/search.ts

**Files:**
- Create: `shared/commands/search.ts`
- Modify: `console/commands/search.ts`
- Create: `shared/tests/commands/search.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/search.test.ts`:

```ts
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
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/search.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/search.ts**

```ts
import type { Task } from '../parser';

export function applySearch(tasks: Task[], term: string): Task[] {
  const lower = term.toLowerCase();
  return tasks.filter(t => t.raw.toLowerCase().includes(lower));
}
```

- [ ] **Update console/commands/search.ts to be a thin wrapper**

```ts
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today, formatTask } from '../output';
import { applySearch } from '../../shared/commands/search';

export function searchCommand(filePath: string, termParts: string[]): void {
  if (termParts.length === 0) { console.error('Usage: todo search <term>'); process.exit(1); }
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const term = termParts.join(' ');
  const todayStr = today();
  const tasks = readTasks(filePath);
  const matches = applySearch(tasks, term);

  matches.forEach(t => console.log(formatTask(t, todayStr)));
  if (matches.length === 0) console.log(`No tasks matching "${term}".`);
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/search.ts shared/tests/commands/search.test.ts console/commands/search.ts
git commit -m "refactor: extract applySearch to shared/commands/search"
```

---

## Task 13: Create shared/commands/report.ts

**Files:**
- Create: `shared/commands/report.ts`
- Modify: `console/commands/report.ts`
- Create: `shared/tests/commands/report.test.ts`

- [ ] **Write failing tests**

Create `shared/tests/commands/report.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { applyReport } from '../../commands/report';
import { parseLine } from '../../parser';

describe('applyReport', () => {
  test('counts open and done tasks', () => {
    const tasks = [
      parseLine('open task', 1),
      parseLine('x 2026-05-23 done task', 2),
    ];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.open).toBe(1);
    expect(result.done).toBe(1);
    expect(result.completedToday).toBe(1);
  });

  test('counts overdue tasks', () => {
    const tasks = [parseLine('overdue task due:2026-05-01', 1)];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.overdue).toBe(1);
  });

  test('groups by project', () => {
    const tasks = [parseLine('task +backend', 1), parseLine('task +backend', 2)];
    const result = applyReport(tasks, '2026-05-23');
    expect(result.byProject.get('+backend')?.open).toBe(2);
  });
});
```

- [ ] **Run to verify failure**

```bash
bun test shared/tests/commands/report.test.ts
```

Expected: fail.

- [ ] **Create shared/commands/report.ts**

```ts
import type { Task } from '../parser';
import { addDays } from '../utils';

export type ReportResult = {
  total: number;
  open: number;
  done: number;
  overdue: number;
  completedToday: number;
  completedThisWeek: number;
  byProject: Map<string, { open: number; done: number }>;
  byContext: Map<string, { open: number; done: number }>;
};

function countByTag(tasks: Task[], getTag: (t: Task) => string[]): Map<string, { open: number; done: number }> {
  const map = new Map<string, { open: number; done: number }>();
  for (const task of tasks) {
    for (const tag of getTag(task)) {
      const entry = map.get(tag) ?? { open: 0, done: 0 };
      if (task.done) entry.done++;
      else entry.open++;
      map.set(tag, entry);
    }
  }
  return map;
}

export function applyReport(tasks: Task[], todayStr: string): ReportResult {
  const weekStart = addDays(todayStr, -6);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  return {
    total: tasks.length,
    open: open.length,
    done: done.length,
    overdue: open.filter(t => t.extensions['due'] !== undefined && t.extensions['due'] < todayStr).length,
    completedToday: done.filter(t => t.completionDate === todayStr).length,
    completedThisWeek: done.filter(t => t.completionDate !== undefined && t.completionDate >= weekStart).length,
    byProject: countByTag(tasks, t => t.projects),
    byContext: countByTag(tasks, t => t.contexts),
  };
}
```

- [ ] **Update console/commands/report.ts to be a thin wrapper**

```ts
import { existsSync } from 'fs';
import { readTasks } from '../store';
import { today } from '../output';
import { applyReport } from '../../shared/commands/report';

export function reportCommand(filePath: string): void {
  if (!existsSync(filePath)) {
    console.error("No todo.txt found in current directory. Run 'todo add' to create one.");
    process.exit(1);
  }

  const todayStr = today();
  const tasks = readTasks(filePath);
  const { total, open, done, overdue, completedToday, completedThisWeek, byProject, byContext } = applyReport(tasks, todayStr);

  console.log('Tasks');
  console.log(`  Total      ${total}`);
  console.log(`  Open       ${open}`);
  console.log(`  Done       ${done}`);
  if (overdue > 0) console.log(`  Overdue    ${overdue}`);

  if (byProject.size > 0) {
    console.log('\nBy Project');
    for (const [proj, counts] of [...byProject.entries()].sort()) {
      const total = counts.open + counts.done;
      const detail = counts.done > 0
        ? `(${counts.open} open, ${counts.done} done)`
        : `(${counts.open} open)`;
      console.log(`  ${proj.padEnd(10)} ${total} task${total === 1 ? ' ' : 's'} ${detail}`);
    }
  }

  if (byContext.size > 0) {
    console.log('\nBy Context');
    for (const [ctx, counts] of [...byContext.entries()].sort()) {
      const total = counts.open + counts.done;
      console.log(`  ${ctx.padEnd(10)} ${total} task${total === 1 ? '' : 's'}`);
    }
  }

  if (done > 0) {
    console.log('\nCompleted');
    console.log(`  Today      ${completedToday}`);
    console.log(`  This week  ${completedThisWeek}`);
  }
}
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add shared/commands/report.ts shared/tests/commands/report.test.ts console/commands/report.ts
git commit -m "refactor: extract applyReport to shared/commands/report"
```

---

## Task 14: Update console/commands/listall.ts

`listall.ts` imports `matchesFilters` from `./list`. After the refactor it still works (since `console/commands/list.ts` re-exports from shared), but update it to import directly from shared for clarity.

**Files:**
- Modify: `console/commands/listall.ts`

- [ ] **Update import in console/commands/listall.ts**

Change:
```ts
import { matchesFilters } from './list';
```
To:
```ts
import { matchesFilters } from '../../shared/commands/list';
```

- [ ] **Run all tests**

```bash
bun test
```

Expected: 309 pass, 0 fail.

- [ ] **Commit**

```bash
git add console/commands/listall.ts
git commit -m "refactor: update listall to import matchesFilters directly from shared"
```

---

## Task 15: Final verification

- [ ] **Run the full test suite**

```bash
bun test
```

Expected output: `309 pass  0 fail`

- [ ] **Smoke test the CLI**

```bash
bun run console/index.ts help
```

Expected: full help text printed with no errors.

- [ ] **Verify todo.sh still works**

```bash
./todo.sh help
```

Expected: same help text.

- [ ] **Confirm shared transforms are importable from TypeScript**

```bash
bun run -e "import { applyDone } from './shared/commands/done'; console.log(typeof applyDone)"
```

Expected: `function`

- [ ] **Commit if anything was missed**

```bash
git status
# If clean, nothing to do. If there are stragglers:
git add -A
git commit -m "refactor: finalize repo restructure cleanup"
```

---

## Summary

After completing all tasks:

- `src/` is gone; `console/` contains the CLI with thin wrappers
- `shared/` contains all pure business logic with no I/O
- All 309 existing tests still pass in `console/tests/`
- New unit tests for pure transforms live in `shared/tests/`
- `todo.sh` and the `todo` symlink both point to `console/index.ts`
- The mobile app (Plan 2) can now import from `shared/` without touching `console/`
