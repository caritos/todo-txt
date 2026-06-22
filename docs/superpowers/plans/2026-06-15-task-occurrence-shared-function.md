# Task Occurrence Shared Function

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a `taskOccurrence(task, todayStr)` function from `shared/commands/focus.ts` so both the console and mobile use the same date-resolution logic instead of each layer duplicating (and getting wrong) start-date parsing and recurrence handling.

**Architecture:** Add `TaskOccurrence` type and `taskOccurrence()` function as exports from `shared/commands/focus.ts`. The function wraps the existing `focusSortKey()` logic and returns a structured `{ date, time }` object (or null if the task has no schedule). Mobile `timeline.tsx` and `day/[date].tsx` import it via the existing `@shared/commands/focus` alias and drop their hand-rolled `resolveStart` / `taskTime` helpers.

**Tech Stack:** TypeScript (shared), Bun test runner, React Native / Expo Router (mobile)

---

### Task 1: Add `taskOccurrence` to shared layer + tests

**Files:**
- Modify: `shared/commands/focus.ts` — add exports at the bottom
- Create: `shared/tests/commands/focus.test.ts`

#### Background

`focusSortKey(task, todayStr)` already computes the correct effective date for every task type:
- Non-recurring with `start:2026-06-15 09:00` → `"2026-06-15 09:00"`
- Non-recurring with `start:today` → `"today"` ← only case that still needs resolution
- Weekly recurring → `nextWeeklyDate(...) + time`
- Monthly recurring → `nextMonthlyDate(...) + time`
- Yearly recurring → `nextYearlyDate(...)`
- Event (`type:` + ongoing) → `todayStr`
- No schedule → `"9999-12-31"`

`taskOccurrence` wraps `focusSortKey`:
1. If result is `"9999-12-31"` → return null
2. If result starts with `"today"` → replace `"today"` prefix with `todayStr`
3. Extract `date = resolved.slice(0, 10)`, `time = resolved.slice(11, 16)` if length > 10
4. Validate date is ISO format (`/^\d{4}-\d{2}-\d{2}$/`); if not → return null
5. Validate time is HH:MM (`/^\d{2}:\d{2}$/`); if not → time = null
6. Return `{ date, time }`

- [ ] **Step 1: Add exports to `shared/commands/focus.ts`**

At the bottom of `shared/commands/focus.ts` (after the existing exports), append:

```ts
// ── Occurrence helper (used by mobile week/day views) ────────────────────────

export type TaskOccurrence = {
  date: string;       // YYYY-MM-DD
  time: string | null; // HH:MM or null
};

export function taskOccurrence(task: Task, todayStr: string): TaskOccurrence | null {
  const sortKey = focusSortKey(task, todayStr);
  if (sortKey === '9999-12-31') return null;
  const resolved = sortKey.startsWith('today') ? todayStr + sortKey.slice(5) : sortKey;
  const date = resolved.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timePart = resolved.length > 10 ? resolved.slice(11, 16) : null;
  const time = timePart && /^\d{2}:\d{2}$/.test(timePart) ? timePart : null;
  return { date, time };
}
```

- [ ] **Step 2: Write failing tests**

Create `shared/tests/commands/focus.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { taskOccurrence } from '../../commands/focus';
import { parseLine } from '../../parser';

function task(raw: string) { return parseLine(raw, 1); }
const TODAY = '2026-06-15';

describe('taskOccurrence', () => {
  test('returns null for task with no start or due', () => {
    expect(taskOccurrence(task('buy milk'), TODAY)).toBeNull();
  });

  test('plain task with ISO start date', () => {
    const t = task(`buy milk start:${TODAY}`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: null });
  });

  test('plain task with start:today literal', () => {
    const t = task('buy milk start:today');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: null });
  });

  test('timed task with ISO start date+time (space separator)', () => {
    const t = task(`call mom start:${TODAY} 09:00`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: '09:00' });
  });

  test('timed task with start:today HH:MM literal', () => {
    const t = task('call mom start:today 06:00');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: TODAY, time: '06:00' });
  });

  test('weekly recurring task shows current occurrence', () => {
    // start was last week, frequency weekly — next occurrence should be this Monday
    const t = task(`mow lawn start:2026-06-08 09:00 frequency:weekly`);
    expect(taskOccurrence(t, TODAY)).toEqual({ date: '2026-06-15', time: '09:00' });
  });

  test('task with only due date', () => {
    const t = task('submit report due:2026-06-20');
    const occ = taskOccurrence(t, TODAY);
    expect(occ?.date).toBe('2026-06-20');
    expect(occ?.time).toBeNull();
  });

  test('future task returns its future date', () => {
    const t = task('dentist start:2026-07-01');
    expect(taskOccurrence(t, TODAY)).toEqual({ date: '2026-07-01', time: null });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/eladio/src/todo-txt && bun test shared/tests/commands/focus.test.ts
```

Expected: some tests fail (function not yet exported) or type errors.

- [ ] **Step 4: Implement and verify tests pass**

The Step 1 code should already make most tests pass. Run again:

```bash
bun test shared/tests/commands/focus.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full shared test suite**

```bash
bun test
```

Expected: all existing tests still pass, new tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "feat(shared): add taskOccurrence helper for date/time resolution"
```

---

### Task 2: Update `mobile/app/timeline.tsx` to use `taskOccurrence`

**Files:**
- Modify: `mobile/app/timeline.tsx`

#### What changes

Remove the hand-rolled `resolveStart` and `taskTime` helpers. Import `taskOccurrence` from `@shared/commands/focus`. Update `tasksPerDay` useMemo and the pill render section.

- [ ] **Step 1: Update imports**

Replace:
```ts
import type { Task } from '@shared/parser';
```
With:
```ts
import type { Task } from '@shared/parser';
import { taskOccurrence } from '@shared/commands/focus';
```

- [ ] **Step 2: Remove `resolveStart` and `taskTime` helpers**

Delete the `resolveStart` function (added as a band-aid) and the `taskTime` function entirely — both are replaced by `taskOccurrence`.

Also remove the `topOffset` function if it's only used internally; keep it if it's still needed for rendering (it maps hours/minutes to pixel offsets — keep it, just remove `taskTime`).

- [ ] **Step 3: Update `tasksPerDay` useMemo**

Replace the current task-bucketing logic with:

```tsx
const { tasksPerDay, busyCounts } = useMemo(() => {
  const perDay = new Map<string, { allDay: Task[]; timed: Task[] }>();
  const counts = new Map<string, number>();
  for (const d of weekDates) perDay.set(d, { allDay: [], timed: [] });
  for (const t of tasks) {
    if (t.done) continue;
    const occ = taskOccurrence(t, todayStr);
    if (!occ) continue;
    const bucket = perDay.get(occ.date);
    if (!bucket) continue;
    counts.set(occ.date, (counts.get(occ.date) ?? 0) + 1);
    if (occ.time) bucket.timed.push(t);
    else bucket.allDay.push(t);
  }
  for (const bucket of perDay.values()) {
    bucket.timed.sort((a, b) => {
      const ta = taskOccurrence(a, todayStr)!.time!;
      const tb = taskOccurrence(b, todayStr)!.time!;
      const [ah, am] = ta.split(':').map(Number);
      const [bh, bm] = tb.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
  }
  return { tasksPerDay: perDay, busyCounts: counts };
}, [tasks, weekDates, todayStr]);
```

- [ ] **Step 4: Update pill render section**

Find the `{timed.map(task => { ... })}` block in the render. Replace the `taskTime` call with `taskOccurrence`:

```tsx
{timed.map(task => {
  const occ = taskOccurrence(task, todayStr);
  if (!occ?.time) return null;
  const [hours, minutes] = occ.time.split(':').map(Number);
  const rawTop = topOffset(hours, minutes);
  if (rawTop < 0 || rawTop >= TIMELINE_HEIGHT) return null;
  return (
    <View key={task.line} style={[styles.pill, { top: rawTop + 1 }]}>
      <Text style={styles.pillText} numberOfLines={1}>{cleanTitle(task.text)}</Text>
    </View>
  );
})}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors found.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/timeline.tsx
git commit -m "refactor(mobile): use shared taskOccurrence in week timeline"
```

---

### Task 3: Update `mobile/app/day/[date].tsx` to use `taskOccurrence`

**Files:**
- Modify: `mobile/app/day/[date].tsx`

#### What changes

Same pattern as Task 2. Remove `resolveStart` and `taskTime` helpers, import `taskOccurrence`, update the useMemo filter and the pill render.

- [ ] **Step 1: Update imports**

Add `taskOccurrence` import (same as Task 2):
```ts
import { taskOccurrence } from '@shared/commands/focus';
```

- [ ] **Step 2: Remove `resolveStart` and `taskTime` helpers**

Delete both functions.

- [ ] **Step 3: Update `useMemo` task filter**

Replace current filter/categorize logic with:

```tsx
const { allDay, timed } = useMemo(() => {
  const allDay: Task[] = [];
  const timed: Task[] = [];
  for (const t of tasks) {
    if (t.done) continue;
    const occ = taskOccurrence(t, todayStr);
    if (!occ || occ.date !== dateStr) continue;
    if (occ.time) timed.push(t);
    else allDay.push(t);
  }
  allDay.sort((a, b) => {
    const pa = a.priority ?? 'ZZZ';
    const pb = b.priority ?? 'ZZZ';
    if (pa !== pb) return pa.localeCompare(pb);
    return a.line - b.line;
  });
  timed.sort((a, b) => {
    const ta = taskOccurrence(a, todayStr)!.time!;
    const tb = taskOccurrence(b, todayStr)!.time!;
    const [ah, am] = ta.split(':').map(Number);
    const [bh, bm] = tb.split(':').map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });
  return { allDay, timed };
}, [tasks, dateStr, todayStr]);
```

- [ ] **Step 4: Update event pill render section**

Replace `taskTime` calls in the `{timed.map(...)}` block:

```tsx
{timed.map(task => {
  const occ = taskOccurrence(task, todayStr);
  if (!occ?.time) return null;
  const [hours, minutes] = occ.time.split(':').map(Number);
  const rawTop = topOffset(hours, minutes);
  if (rawTop < 0 || rawTop >= TIMELINE_HEIGHT) return null;
  const top = rawTop + 2;
  return (
    <View key={task.line} style={[styles.eventPill, { top, left: LABEL_WIDTH, right: 8 }]}>
      <Text style={styles.eventTime}>{formatTime(hours, minutes)}</Text>
      <Text style={styles.eventTitle} numberOfLines={1}>{cleanTitle(task.text)}</Text>
    </View>
  );
})}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/day/[date].tsx
git commit -m "refactor(mobile): use shared taskOccurrence in day view"
```
