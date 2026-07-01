# Fix Recurring Date Clamping & Birthday Age Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issue #57 ("wrong due date") — a recurring yearly/monthly task whose `start:` day-of-month doesn't exist in the target month (e.g. June 31st) is displayed inconsistently across screens (Calendar shows June 30, Task Detail shows July 1) — and add a birthday/anniversary "age in years" display to mobile, matching an existing CLI feature.

**Architecture:** Three independent-but-related bugs, fixed at their common root in the shared layer so every consumer (console CLI, mobile) inherits the fix automatically:
1. `nextYearlyDate`/`nextMonthlyDate`/`overdueOccurrenceDate` in `shared/commands/focus.ts` currently build occurrence date strings without validating the day exists in the target month. Clamp at the single point where each function picks a day-of-month, using a new `daysInMonth` helper.
2. `applyDone` (`shared/commands/done.ts`) currently overwrites a yearly-frequency task's `start:` **year** on every completion. This is unnecessary (yearly-occurrence math only needs the month-day, not the year) and destroys the original birth/anniversary year needed for age calculation. Stop advancing the year for `frequency:yearly` only; weekly/monthly/daily are untouched.
3. Port the CLI's existing `computeYearCount` (`console/output.ts`) into the shared layer (`shared/commands/list.ts`) so both console and mobile can compute "(N years)" for `type:birthday`/`type:anniversary` tasks from the same source of truth, then wire it into mobile's Task Detail screen alongside a DUE-date fix that routes through the shared occurrence calculator instead of formatting the raw `start:` field directly.

**Tech Stack:** TypeScript, Bun test runner (shared/console), Jest (mobile).

## Global Constraints

- Shared layer transforms are pure functions: `Task[]`/`Task` in, result out — no I/O, no `process.exit` (see repo `CLAUDE.md`).
- `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- Run shared/console tests with `bun test`. Run a single file with `bun test <path>`.
- Run mobile tests with `cd mobile && npm test`.
- Do not modify `mobile/src/utils.ts`, `mobile/app/calendar.tsx`, or any other date-*display*-formatting call site — once the source (`focus.ts`) only ever produces valid calendar-date strings, every existing `new Date(dateStr + 'T12:00:00')` formatter downstream becomes safe automatically. Touching them is unnecessary scope creep.

---

### Task 1: Add `daysInMonth` shared date utility

**Files:**
- Modify: `shared/utils.ts`
- Test: `shared/tests/utils.test.ts` (new file)

**Interfaces:**
- Produces: `daysInMonth(year: number, month0: number): number` — `month0` is 0-indexed (0=Jan..11=Dec), exported from `shared/utils.ts`. Later tasks import this from `../utils` (within `shared/commands/`).

- [ ] **Step 1: Write the failing test**

Create `shared/tests/utils.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { daysInMonth } from '../utils';

describe('daysInMonth', () => {
  test('returns 30 for June (month0=5)', () => {
    expect(daysInMonth(2026, 5)).toBe(30);
  });

  test('returns 31 for January (month0=0)', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
  });

  test('returns 28 for February in a non-leap year', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
  });

  test('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
  });

  test('returns 31 for December (month0=11)', () => {
    expect(daysInMonth(2026, 11)).toBe(31);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test shared/tests/utils.test.ts`
Expected: FAIL — `daysInMonth` is not exported from `../utils`.

- [ ] **Step 3: Write minimal implementation**

In `shared/utils.ts`, add this export (keep the existing `addDays` function untouched, just add below it):

```ts
export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test shared/tests/utils.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/utils.ts shared/tests/utils.test.ts
git commit -m "feat(shared): add daysInMonth date utility"
```

---

### Task 2: Clamp day-of-month in `nextYearlyDate`

**Files:**
- Modify: `shared/commands/focus.ts:1` (import), `shared/commands/focus.ts:56-62` (`occurrenceForYear` inside `nextYearlyDate`)
- Test: `shared/tests/commands/focus.test.ts`

**Interfaces:**
- Consumes: `daysInMonth(year, month0)` from Task 1 (`../utils`).
- Produces: no signature change to `nextYearlyDate` — same exported function, now always returns a syntactically valid `YYYY-MM-DD` string.

- [ ] **Step 1: Write the failing test**

Add to `shared/tests/commands/focus.test.ts` (inside a new `describe('nextYearlyDate day clamping', ...)` block — append at the end of the file):

```ts
describe('nextYearlyDate day clamping', () => {
  test('clamps June 31 to June 30', () => {
    // start's literal day (31) doesn't exist in June (30 days)
    const result = nextYearlyDate('2028-06-31', '2026-07-01', new Set());
    expect(result).toBe('2027-06-30');
  });

  test('clamps Feb 29 to Feb 28 in a non-leap year', () => {
    const result = nextYearlyDate('1990-02-29', '2026-01-01', new Set());
    expect(result).toBe('2026-02-28');
  });

  test('keeps Feb 29 in a leap year', () => {
    const result = nextYearlyDate('1990-02-29', '2024-01-01', new Set());
    expect(result).toBe('2024-02-29');
  });

  test('every>1 branch also clamps', () => {
    const result = nextYearlyDate('2020-06-31', '2026-01-01', new Set(), undefined, 2);
    expect(result).toBe('2026-06-30');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test shared/tests/commands/focus.test.ts`
Expected: FAIL — `'2027-06-31'` !== `'2027-06-30'` (and similarly for the other three).

- [ ] **Step 3: Write minimal implementation**

In `shared/commands/focus.ts`, change the import on line 1 from:

```ts
import { addDays } from '../utils';
```

to:

```ts
import { addDays, daysInMonth } from '../utils';
```

Then replace `occurrenceForYear` inside `nextYearlyDate` (currently lines 56-62):

```ts
  function occurrenceForYear(year: number): string {
    if (frequencyMonthDay && isNaN(Number(frequencyMonthDay))) {
      const day = resolvePositionalDay(year, month0, frequencyMonthDay);
      return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${year}-${start.slice(5, 10)}`;
  }
```

with:

```ts
  function occurrenceForYear(year: number): string {
    if (frequencyMonthDay && isNaN(Number(frequencyMonthDay))) {
      const day = resolvePositionalDay(year, month0, frequencyMonthDay);
      return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const day = Math.min(parseInt(start.slice(8, 10), 10), daysInMonth(year, month0));
    return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test shared/tests/commands/focus.test.ts`
Expected: PASS (all tests including the 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "fix(focus): clamp yearly occurrence day-of-month to days in target month"
```

---

### Task 3: Clamp day-of-month in monthly occurrence functions

**Files:**
- Modify: `shared/commands/focus.ts` — `resolvePositionalDay` (currently lines 20-39), `nextMonthlyDate`'s `dayForMonth` (currently lines 142-146), `overdueOccurrenceDate`'s local `dayForMonth` (currently lines 223-227)
- Test: `shared/tests/commands/focus.test.ts`

**Interfaces:**
- Consumes: `daysInMonth(year, month0)` from Task 1 (already imported into `focus.ts` by Task 2).
- Produces: no signature changes; `nextMonthlyDate` and `overdueOccurrenceDate` now only ever compute valid calendar dates.

- [ ] **Step 1: Write the failing test**

`nextMonthlyDate` is already imported at the top of `shared/tests/commands/focus.test.ts` via the existing `import { taskOccurrence, nextMonthlyDate, nextYearlyDate, focusSortKey } from '../../commands/focus';` line — reuse it, no new import needed. Add this block to the file:

```ts
describe('nextMonthlyDate day clamping', () => {
  test('clamps day 31 to Feb 28 in a non-leap year', () => {
    const result = nextMonthlyDate('2026-01-31', '2026-02-01', new Set());
    expect(result).toBe('2026-02-28');
  });

  test('clamps day 31 to Feb 29 in a leap year', () => {
    const result = nextMonthlyDate('2024-01-31', '2024-02-01', new Set());
    expect(result).toBe('2024-02-29');
  });

  test('every>1 branch also clamps', () => {
    // Quarterly (every:3) from Jan 31: cycle lands on Jan(0), Apr(3), Jul(6)...
    // April only has 30 days. Before this fix, dayForMonth() returned the
    // unclamped 31, so new Date(2026, 3, 31) silently overflowed to May 1 —
    // verified by running this exact call against the pre-fix code, which
    // returned '2026-05-01'. After clamping it must return April 30 instead.
    const result = nextMonthlyDate('2026-01-31', '2026-04-01', new Set(), undefined, 3);
    expect(result).toBe('2026-04-30');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test shared/tests/commands/focus.test.ts`
Expected: FAIL — without clamping, day 31 in February overflows to March 2 (non-leap) or March 2 (leap, since Feb 29 + overflow of 2 more days), not Feb 28/29.

- [ ] **Step 3: Write minimal implementation**

In `shared/commands/focus.ts`, update `resolvePositionalDay` (currently lines 20-39) to use the imported `daysInMonth` instead of its local inline computation:

```ts
function resolvePositionalDay(year: number, month: number, positionalDay: string): number {
  const dashIdx = positionalDay.indexOf('-');
  const position = positionalDay.slice(0, dashIdx);
  const dayType = positionalDay.slice(dashIdx + 1);
  const totalDays = daysInMonth(year, month);
  if (position === 'last') {
    for (let d = totalDays; d >= 1; d--) {
      if (matchesDayType(new Date(year, month, d).getDay(), dayType)) return d;
    }
    return totalDays;
  }
  const count = POSITIONAL_POSITIONS[position] ?? 1;
  let found = 0;
  for (let d = 1; d <= totalDays; d++) {
    if (matchesDayType(new Date(year, month, d).getDay(), dayType)) {
      if (++found === count) return d;
    }
  }
  return 1;
}
```

(This is a pure rename of the local `daysInMonth` variable to `totalDays` so it no longer shadows the imported function — behavior is unchanged here, just freeing up the name.)

Then update `nextMonthlyDate`'s `dayForMonth` (currently lines 142-146) from:

```ts
  function dayForMonth(year: number, month: number): number {
    const fmd = frequencyMonthDay ?? startStr.slice(8, 10);
    if (isNaN(Number(fmd))) return resolvePositionalDay(year, month, fmd);
    return parseInt(fmd);
  }
```

to:

```ts
  function dayForMonth(year: number, month: number): number {
    const fmd = frequencyMonthDay ?? startStr.slice(8, 10);
    if (isNaN(Number(fmd))) return resolvePositionalDay(year, month, fmd);
    return Math.min(parseInt(fmd, 10), daysInMonth(year, month));
  }
```

Then update `overdueOccurrenceDate`'s local `dayForMonth` (currently lines 223-227) from:

```ts
    function dayForMonth(year: number, month: number): number {
      const val = fmd ?? startDate.slice(8, 10);
      if (isNaN(Number(val))) return resolvePositionalDay(year, month, val);
      return parseInt(val);
    }
```

to:

```ts
    function dayForMonth(year: number, month: number): number {
      const val = fmd ?? startDate.slice(8, 10);
      if (isNaN(Number(val))) return resolvePositionalDay(year, month, val);
      return Math.min(parseInt(val, 10), daysInMonth(year, month));
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test shared/tests/commands/focus.test.ts`
Expected: PASS (all tests)

Also run the full shared suite to confirm no regression in existing monthly/positional-day tests:

Run: `bun test shared/`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "fix(focus): clamp monthly occurrence day-of-month to days in target month"
```

---

### Task 4: Stop advancing `start:` year for yearly-frequency tasks in `applyDone`

**Files:**
- Modify: `shared/commands/done.ts:4` (import), `shared/commands/done.ts:67-96` (the start-advancing block inside `applyDone`)
- Test: `shared/tests/commands/done.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change to `applyDone`. Behavior change: for `frequency:yearly` tasks, `task.extensions['start']` (and the `start:` token in `task.text`/`task.raw`) is left completely unchanged after `applyDone` — only `last-done` advances. Weekly/monthly/daily behavior is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `shared/tests/commands/done.test.ts` (append a new `describe` block at the end of the file):

```ts
describe('applyDone with frequency:yearly', () => {
  test('does not advance start: year — only last-done changes', () => {
    const tasks = [makeTask('Birthday start:1990-03-15 frequency:yearly type:birthday')];
    const { tasks: updated } = applyDone(tasks, [1], '2026-03-15');
    expect(updated[0]!.extensions['start']).toBe('1990-03-15');
    expect(updated[0]!.extensions['last-done']).toBe('2026-03-15');
  });

  test('start: year stays fixed across multiple completions', () => {
    let tasks = [makeTask('Birthday start:1990-03-15 frequency:yearly type:birthday')];
    tasks = applyDone(tasks, [1], '2026-03-15').tasks;
    tasks = applyDone(tasks, [1], '2027-03-15').tasks;
    expect(tasks[0]!.extensions['start']).toBe('1990-03-15');
    expect(tasks[0]!.extensions['last-done']).toBe('2027-03-15');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test shared/tests/commands/done.test.ts`
Expected: FAIL — `updated[0].extensions['start']` is currently `'2027-03-15'` (advanced), not `'1990-03-15'`.

- [ ] **Step 3: Write minimal implementation**

In `shared/commands/done.ts`, change the import on line 4 from:

```ts
import { nextWeeklyDate, nextMonthlyDate, nextYearlyDate, overdueOccurrenceDate } from './focus';
```

to:

```ts
import { nextWeeklyDate, nextMonthlyDate, overdueOccurrenceDate } from './focus';
```

Then replace the start-advancing block (currently lines 67-96):

```ts
      if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'yearly' || freq === 'daily')) {
        const every = parseInt(task.extensions['every'] ?? '1');
        const exdates = new Set<string>((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
        const freqDay = task.extensions['frequency-day'];
        const freqMonthDay = task.extensions['frequency-month-day'];
        let currentOcc: string;
        let nextOcc: string;
        if (freq === 'weekly') {
          currentOcc = overdueOcc ?? nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
          nextOcc = nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay);
        } else if (freq === 'monthly') {
          currentOcc = overdueOcc ?? nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
          nextOcc = nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay, every);
        } else if (freq === 'daily') {
          const startDate = startVal.slice(0, 10);
          const startMs = new Date(startDate + 'T12:00:00').getTime();
          const todayMs = new Date(todayStr + 'T12:00:00').getTime();
          const daysSinceStart = Math.round((todayMs - startMs) / 86400000);
          const cycles = daysSinceStart <= 0 ? 0 : Math.ceil(daysSinceStart / every);
          currentOcc = addDays(startDate, cycles * every);
          nextOcc = addDays(currentOcc, every);
        } else {
          currentOcc = nextYearlyDate(startVal.slice(0, 10), todayStr, exdates, freqMonthDay, every);
          nextOcc = nextYearlyDate(startVal.slice(0, 10), addDays(currentOcc, 1), exdates, freqMonthDay, every);
        }
        const timePart = startVal.slice(10);
        const newStart = nextOcc + timePart;
        task.text = task.text.replace(/\bstart:\S+/g, `start:${newStart}`);
        task.extensions['start'] = newStart;
      }
```

with (yearly removed from the outer condition and from the branch chain — `start:` is simply left untouched for yearly):

```ts
      if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'daily')) {
        const every = parseInt(task.extensions['every'] ?? '1');
        const exdates = new Set<string>((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
        const freqDay = task.extensions['frequency-day'];
        const freqMonthDay = task.extensions['frequency-month-day'];
        let currentOcc: string;
        let nextOcc: string;
        if (freq === 'weekly') {
          currentOcc = overdueOcc ?? nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
          nextOcc = nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay);
        } else if (freq === 'monthly') {
          currentOcc = overdueOcc ?? nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
          nextOcc = nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay, every);
        } else {
          const startDate = startVal.slice(0, 10);
          const startMs = new Date(startDate + 'T12:00:00').getTime();
          const todayMs = new Date(todayStr + 'T12:00:00').getTime();
          const daysSinceStart = Math.round((todayMs - startMs) / 86400000);
          const cycles = daysSinceStart <= 0 ? 0 : Math.ceil(daysSinceStart / every);
          currentOcc = addDays(startDate, cycles * every);
          nextOcc = addDays(currentOcc, every);
        }
        const timePart = startVal.slice(10);
        const newStart = nextOcc + timePart;
        task.text = task.text.replace(/\bstart:\S+/g, `start:${newStart}`);
        task.extensions['start'] = newStart;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test shared/tests/commands/done.test.ts`
Expected: PASS (all tests, including the 2 new ones)

Also run the full shared suite:

Run: `bun test shared/`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add shared/commands/done.ts shared/tests/commands/done.test.ts
git commit -m "fix(done): stop advancing start: year for frequency:yearly tasks

Yearly-occurrence scheduling only needs start:'s month-day (the year is
recomputed fresh from today's year on every read via nextYearlyDate), so
advancing the year on every completion was unnecessary. It also silently
destroyed the original birth/anniversary year, breaking the CLI's existing
type:birthday/anniversary age display after the first completion, and
breaking every:N>1 yearly cycle math (which needs a fixed anchor year).

Fixes #57"
```

---

### Task 5: Move `computeYearCount` to the shared layer

**Files:**
- Modify: `shared/commands/list.ts` (add export), `console/output.ts:47-57` (remove local definition, import from shared, adjust call sites)
- Test: `shared/tests/commands/list.test.ts`

**Interfaces:**
- Produces: `computeYearCount(task: Task, todayStr: string): number | undefined` exported from `shared/commands/list.ts`. Returns the whole number of years since `start:`'s year for `type:birthday`/`type:anniversary` tasks with a `start:` set and a positive year count; `undefined` otherwise. (Note: this returns a bare number, not a pre-formatted string — callers format their own display string, e.g. `` `(${years} years)` ``.)
- Consumes (Task 6): mobile's `task/[line].tsx` will import this same function from `@shared/commands/list`.

- [ ] **Step 1: Write the failing test**

Add to `shared/tests/commands/list.test.ts` (append a new `describe` block; also add `computeYearCount` to the existing import line at the top of the file):

Change the top import from:
```ts
import { matchesFilters, sortByPriority, isPastEvent, toJsonTask } from '../../commands/list';
```
to:
```ts
import { matchesFilters, sortByPriority, isPastEvent, toJsonTask, computeYearCount } from '../../commands/list';
```

Then append:

```ts
describe('computeYearCount', () => {
  test('computes years for type:birthday', () => {
    const t = parseLine('John Birthday start:1990-03-15 frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-03-15')).toBe(36);
  });

  test('computes years for type:anniversary', () => {
    const t = parseLine('Anniversary start:1984-05-06 frequency:yearly type:anniversary', 1);
    expect(computeYearCount(t, '2026-05-06')).toBe(42);
  });

  test('returns undefined for type:event', () => {
    const t = parseLine('Team standup start:2024-05-06 type:event', 1);
    expect(computeYearCount(t, '2026-05-06')).toBeUndefined();
  });

  test('returns undefined when start: is missing', () => {
    const t = parseLine('Birthday frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-05-06')).toBeUndefined();
  });

  test('returns undefined when years would be zero or negative', () => {
    const t = parseLine('Birthday start:2026-03-15 frequency:yearly type:birthday', 1);
    expect(computeYearCount(t, '2026-03-15')).toBeUndefined();
  });
});
```

`parseLine` is already imported at the top of `shared/tests/commands/list.test.ts` per the existing file — reuse it, do not add a duplicate import.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test shared/tests/commands/list.test.ts`
Expected: FAIL — `computeYearCount` is not exported from `../../commands/list`.

- [ ] **Step 3: Write minimal implementation**

In `shared/commands/list.ts`, add this export after the existing `YEARLY_TYPES` constant (currently line 37) and before `isPastEvent`:

```ts
export function computeYearCount(task: Task, todayStr: string): number | undefined {
  const type = task.extensions['type'];
  if (!type || !YEARLY_TYPES.has(type)) return undefined;
  const start = task.extensions['start'];
  if (!start) return undefined;
  const startYear = parseInt(start.slice(0, 4), 10);
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const years = currentYear - startYear;
  return years > 0 ? years : undefined;
}
```

Now update `console/output.ts` to use the shared version instead of its own local copy. Change the import at the top of `console/output.ts` from:

```ts
import type { Task } from '../shared/parser';
import { addDays } from '../shared/utils';
```

to:

```ts
import type { Task } from '../shared/parser';
import { addDays } from '../shared/utils';
import { computeYearCount } from '../shared/commands/list';
```

Then remove the local `computeYearCount` function definition (currently lines 47-57):

```ts
function computeYearCount(task: Task, todayStr: string): string | undefined {
  const type = task.extensions['type'];
  if (type !== 'anniversary' && type !== 'birthday') return undefined;
  const start = task.extensions['start'];
  if (!start) return undefined;
  const startYear = parseInt(start.slice(0, 4), 10);
  const currentYear = parseInt(todayStr.slice(0, 4), 10);
  const years = currentYear - startYear;
  if (years <= 0) return undefined;
  return `(${years} years)`;
}
```

Delete it entirely (the shared import above replaces it), then update the two call sites that previously received a pre-formatted string to format it themselves.

In `formatTask` (currently around line 72), change:

```ts
  const yearCount = computeYearCount(task, todayStr);
```

to:

```ts
  const years = computeYearCount(task, todayStr);
  const yearCount = years !== undefined ? `(${years} years)` : undefined;
```

In `formatFocusTask` (currently around line 98), change:

```ts
  const yearCount = computeYearCount(task, todayStr);
```

to:

```ts
  const years = computeYearCount(task, todayStr);
  const yearCount = years !== undefined ? `(${years} years)` : undefined;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test shared/tests/commands/list.test.ts`
Expected: PASS (all tests, including the 5 new ones)

Then run the full test suites to confirm no regression in the console's existing "(N years)" integration tests:

Run: `bun test`
Expected: PASS (all tests across `shared/` and `console/`)

- [ ] **Step 5: Commit**

```bash
git add shared/commands/list.ts shared/tests/commands/list.test.ts console/output.ts
git commit -m "refactor(list): move computeYearCount to shared layer for mobile reuse"
```

---

### Task 6: Fix mobile Task Detail DUE date + add birthday/anniversary age display

**Files:**
- Modify: `mobile/app/task/[line].tsx`

**Interfaces:**
- Consumes: `taskOccurrence(task, todayStr): { date: string; time: string | null } | null` from `@shared/commands/focus` (already exists, used elsewhere in mobile per repo docs). `computeYearCount(task, todayStr): number | undefined` from `@shared/commands/list` (Task 5).
- No test file — this is a React Native screen component and the repo has no component-rendering test infrastructure (no `@testing-library/react-native` dependency; all mobile tests are logic/store-level per `mobile/src/__tests__/`). Verify manually per Task 7.

- [ ] **Step 1: Update imports**

In `mobile/app/task/[line].tsx`, change:

```ts
import { today, formatDateLabel } from '../../src/utils';
```

to:

```ts
import { today, formatDateLabel } from '../../src/utils';
import { taskOccurrence } from '@shared/commands/focus';
import { computeYearCount } from '@shared/commands/list';
```

- [ ] **Step 2: Compute the canonical due date and year count**

Immediately after the existing line `const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);` (currently line 42), add:

```ts
  const occurrence = task.extensions['start'] ? taskOccurrence(task, todayStr) : null;
  const dueDate = occurrence?.date ?? task.extensions['start']?.slice(0, 10);
  const years = computeYearCount(task, todayStr);
```

- [ ] **Step 3: Use the computed due date in the DUE row and add an AGE row**

Replace the existing DUE block (currently lines 140-150):

```tsx
      {task.extensions['start'] && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>DUE</Text>
          <Text style={[
            styles.dueValue,
            !task.done && task.extensions['start'].slice(0, 10) < todayStr && styles.dueOverdue,
          ]}>
            {formatDateLabel(task.extensions['start'].slice(0, 10))}
          </Text>
        </View>
      )}
```

with:

```tsx
      {task.extensions['start'] && dueDate && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>DUE</Text>
          <Text style={[
            styles.dueValue,
            !task.done && dueDate < todayStr && styles.dueOverdue,
          ]}>
            {formatDateLabel(dueDate)}
          </Text>
        </View>
      )}

      {years !== undefined && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>AGE</Text>
          <Text style={styles.dueValue}>{years} years</Text>
        </View>
      )}
```

- [ ] **Step 4: Type-check the mobile project**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new type errors introduced by this file.

- [ ] **Step 5: Run mobile test suite**

Run: `cd mobile && npm test`
Expected: PASS (no existing test exercises this screen file, so this should be unaffected — this step confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add mobile/app/task/[line].tsx
git commit -m "fix(mobile): route Task Detail DUE date through shared occurrence calculator; show birthday/anniversary age

Previously the DUE row formatted task.extensions['start'] directly, which
could show a different (and possibly invalid-day-of-month) date than every
other screen (Calendar, Focus, Day/Week views) that already computes the
next occurrence via taskOccurrence/focusSortKey. Routing through the same
shared function guarantees Task Detail always agrees with the rest of the
app, and self-heals already-corrupted stored start: values without needing
a data migration.

Fixes #57"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full shared/console test suite**

Run: `bun test`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run the full mobile test suite**

Run: `cd mobile && npm test`
Expected: PASS, 0 failures.

- [ ] **Step 3: Manually verify the exact repro case from issue #57**

Using the console CLI (fastest way to check the underlying shared-layer fix without a simulator build):

```bash
cd /Volumes/robin/src/todo-txt
echo '~roger-mella %birthday start:2028-06-31 frequency:yearly type:event last-done:2026-07-01' > /tmp/repro-todo.txt
bun run ./console/index.ts --file /tmp/repro-todo.txt focus
```

Expected: the birthday event's displayed date is now consistently **Jun 30** (not Jul 1), since `nextYearlyDate` now clamps June 31 → June 30 before any downstream formatting sees it.

- [ ] **Step 4: Manually verify the age display and start-year stability end-to-end**

```bash
echo "John's Birthday start:1990-03-15 frequency:yearly type:birthday" > /tmp/repro-birthday.txt
bun run ./console/index.ts --file /tmp/repro-birthday.txt focus
bun run ./console/index.ts --file /tmp/repro-birthday.txt done 1
cat /tmp/repro-birthday.txt
```

Expected: the `focus` output shows `(N years)` next to the birthday (N = current year − 1990). After `done 1`, `cat` shows `start:1990-03-15` is **unchanged** (year still 1990) and a new `last-done:<today>` extension was added, and a new completed `x <today> ... John's Birthday ...` line was appended.

- [ ] **Step 5: Clean up scratch files**

```bash
rm -f /tmp/repro-todo.txt /tmp/repro-birthday.txt
```

- [ ] **Step 6: Verify mobile app manually (recommended, not required)**

If a simulator/device build is available, open the app, navigate to Task Detail for a `type:birthday` task with `frequency:yearly`, and confirm the DUE date and a new AGE row (`N years`) both render correctly, and that they match what the Calendar/Focus screens show for the same task.
