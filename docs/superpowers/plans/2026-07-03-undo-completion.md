# Undo Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping the checkbox on an already-completed, non-recurring task marks it not-done again (GitHub issue #68).

**Architecture:** Add `applyUndone` to the shared layer as a sibling to `applyDone` (one pure function per verb, matching the existing `applyPri`/`applyDepri` pairing). The mobile `usePendingDone` hook — already shared by Calendar and Day view — branches its `tapCheckbox` on `task.done` to call the right one. Calendar's completed rows get wired to actually invoke `tapCheckbox`; Day view already does.

**Tech Stack:** TypeScript, Bun test (shared layer), Jest (mobile layer), React hooks (Expo/React Native).

**Spec:** `docs/superpowers/specs/2026-07-03-undo-completion-design.md`

## Global Constraints

- Non-recurring tasks only this round. A task carrying both `frequency` and `start` extensions must be skipped, not undone.
- Undo is immediate — no pending-delay/grace-timer (unlike the complete-side flow, which has a 2.5s delay).
- Priority is never restored on undo — it was already permanently stripped by `applyDone`. Do not attempt to preserve or recompute it.
- Out of scope, do not touch: Task Detail (`mobile/app/task/[line].tsx`), Search's swipe-to-done (`TaskRow`'s `onDone`), `mobile/app/done.tsx` (unreachable from nav), and any recurring-task occurrence.
- No new mobile test coverage is being added for the hook or `calendar.tsx` — this codebase doesn't unit-test screen-level or hook-level UI logic (no existing test for `usePendingDone`, no test harness for `calendar.tsx`'s agenda builder). Verification for those tasks is `tsc --noEmit` + the existing mobile Jest suite staying green, not new assertions.

---

### Task 1: Add `applyUndone` to the shared layer

**Files:**
- Modify: `shared/commands/done.ts`
- Test: `shared/tests/commands/done.test.ts`

**Interfaces:**
- Consumes: `Task` type and `serializeTask` from `shared/parser.ts` (already imported in `done.ts`).
- Produces: `applyUndone(tasks: Task[], nums: number[]): { tasks: Task[]; undone: Task[]; skipped: UndoneSkip[] }` and `UndoneSkip { num: number; reason: 'not-done' | 'recurring-not-supported' }`, both exported from `shared/commands/done.ts`. Task 2 imports both by name.

- [ ] **Step 1: Write the failing tests**

Add this import change and new `describe` block to the end of `shared/tests/commands/done.test.ts` (the file currently ends at line 98 with the closing `});` of `describe('applyDone recurrence-copy line numbers', ...)`):

Change the top import line:
```ts
import { applyDone } from '../../commands/done';
```
to:
```ts
import { applyDone, applyUndone } from '../../commands/done';
```

Append this new block after the final `});` in the file:
```ts

describe('applyUndone', () => {
  test('undoes a plain done task', () => {
    const tasks = [makeTask('x 2026-05-23 call dentist')];
    const { tasks: updated, undone } = applyUndone(tasks, [1]);
    expect(undone).toHaveLength(1);
    expect(updated[0]!.done).toBe(false);
    expect(updated[0]!.completionDate).toBeUndefined();
    expect(updated[0]!.raw).toBe('call dentist');
  });

  test('does not restore priority lost on completion', () => {
    const tasks = [makeTask('(A) call dentist')];
    const { tasks: afterDone } = applyDone(tasks, [1], '2026-05-23');
    const { tasks: afterUndone } = applyUndone(afterDone, [1]);
    expect(afterUndone[0]!.priority).toBeUndefined();
    expect(afterUndone[0]!.raw).toBe('call dentist');
  });

  test('skips a task that is not done', () => {
    const tasks = [makeTask('call dentist')];
    const { tasks: updated, undone, skipped } = applyUndone(tasks, [1]);
    expect(undone).toHaveLength(0);
    expect(skipped).toEqual([{ num: 1, reason: 'not-done' }]);
    expect(updated[0]!.done).toBe(false);
  });

  test('skips a recurring task even if done is true', () => {
    const tasks = [makeTask('x 2026-05-23 mow lawn start:2026-05-22 frequency:weekly')];
    const { undone, skipped } = applyUndone(tasks, [1]);
    expect(undone).toHaveLength(0);
    expect(skipped).toEqual([{ num: 1, reason: 'recurring-not-supported' }]);
  });

  test('throws for unknown line number', () => {
    const tasks = [makeTask('call dentist')];
    expect(() => applyUndone(tasks, [99])).toThrow('no task #99');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared/tests/commands/done.test.ts`
Expected: FAIL — `applyUndone` is not exported from `../../commands/done` (a TypeScript/module resolution error, since the import itself will fail to resolve the name).

- [ ] **Step 3: Implement `applyUndone`**

Append this to the end of `shared/commands/done.ts` (after the closing `}` of `applyDone`, which currently ends the file at line 114):

```ts

export interface UndoneSkip {
  num: number;
  reason: 'not-done' | 'recurring-not-supported';
}

export function applyUndone(
  tasks: Task[],
  nums: number[],
): { tasks: Task[]; undone: Task[]; skipped: UndoneSkip[] } {
  const undone: Task[] = [];
  const skipped: UndoneSkip[] = [];

  for (const n of nums) {
    const task = tasks.find(t => t.line === n);
    if (!task) throw new Error(`no task #${n}`);

    const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);
    if (isRecurring) {
      skipped.push({ num: n, reason: 'recurring-not-supported' });
      continue;
    }

    if (!task.done) {
      skipped.push({ num: n, reason: 'not-done' });
      continue;
    }

    task.done = false;
    task.completionDate = undefined;
    task.raw = serializeTask(task);
    undone.push(task);
  }

  return { tasks, undone, skipped };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared/tests/commands/done.test.ts`
Expected: `15 pass` (10 existing + 5 new), `0 fail`.

- [ ] **Step 5: Run the full shared+console suite to check for regressions**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, `0 fail` (399 existing + 5 new = 404 total).

- [ ] **Step 6: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add shared/commands/done.ts shared/tests/commands/done.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): add applyUndone to reverse a non-recurring task's completion

Sibling to applyDone, following the applyPri/applyDepri one-function-
per-verb pairing. Recurring tasks (frequency: + start:) are explicitly
unsupported this round — see docs/superpowers/specs/2026-07-03-undo-
completion-design.md.

Part of #68.
EOF
)"
```

---

### Task 2: Wire `usePendingDone` to undo on tap

**Files:**
- Modify: `mobile/src/hooks/usePendingDone.ts`

**Interfaces:**
- Consumes: `applyUndone(tasks: Task[], nums: number[]): { tasks: Task[]; undone: Task[]; skipped: UndoneSkip[] }` from `@shared/commands/done` (Task 1).
- Produces: no change to the hook's public shape — still `{ isPending: (line: number) => boolean; tapCheckbox: (task: Task) => void }`. Existing callers (`mobile/app/calendar.tsx`, `mobile/app/day/[date].tsx`, `mobile/app/done.tsx`) need no signature changes.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `mobile/src/hooks/usePendingDone.ts` with:

```ts
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Task } from '@shared/parser';
import { applyDone, applyUndone } from '@shared/commands/done';

export function usePendingDone(
  tasks: Task[],
  todayStr: string,
  save: (updated: Task[]) => Promise<void>,
  delayMs = 2500,
): {
  isPending: (line: number) => boolean;
  tapCheckbox: (task: Task) => void;
} {
  const [pendingLines, setPendingLines] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Keep a ref so the timer callback always reads the latest tasks list,
  // avoiding stale-closure bugs when tasks change before the timer fires.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const todayStrRef = useRef(todayStr);
  useEffect(() => { todayStrRef.current = todayStr; }, [todayStr]);

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, []);

  const isPending = useCallback(
    (line: number) => pendingLines.has(line),
    [pendingLines],
  );

  const tapCheckbox = useCallback(
    (task: Task) => {
      const line = task.line;

      if (task.done) {
        // Undo is immediate, with no pending-delay grace window. The delay on
        // the complete side exists so a batch of taps isn't over-committed
        // while scrolling; a correction tap on an already-completed row is a
        // single deliberate action.
        void (async () => {
          try {
            const { tasks: updated } = applyUndone([...tasksRef.current], [line]);
            await save(updated);
          } catch {}
        })();
        return;
      }

      if (timers.current.has(line)) {
        // Undo: cancel the pending completion
        clearTimeout(timers.current.get(line));
        timers.current.delete(line);
        setPendingLines(prev => {
          const next = new Set(prev);
          next.delete(line);
          return next;
        });
      } else {
        // Start pending
        setPendingLines(prev => new Set([...prev, line]));
        const timer = setTimeout(async () => {
          timers.current.delete(line);
          try {
            const { tasks: updated } = applyDone([...tasksRef.current], [line], todayStrRef.current);
            await save(updated);
          } catch {}
          setPendingLines(prev => {
            const next = new Set(prev);
            next.delete(line);
            return next;
          });
        }, delayMs);
        timers.current.set(line, timer);
      }
    },
    [save, delayMs],
  );

  return { isPending, tapCheckbox };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Run the mobile Jest suite to check for regressions**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 88 passed, 88 total` (no new tests here — see Global Constraints).

- [ ] **Step 4: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/src/hooks/usePendingDone.ts
git commit -m "$(cat <<'EOF'
feat(mobile): tapCheckbox undoes an already-done task immediately

Branches on task.done: the existing pending-delay flow still applies
to completing an incomplete task, but tapping a done task now calls
applyUndone right away, no grace window. day/[date].tsx already calls
tapCheckbox unconditionally, so Day view picks this up with no file
change of its own.

Part of #68.
EOF
)"
```

---

### Task 3: Make Calendar's completed rows tappable

**Files:**
- Modify: `mobile/app/calendar.tsx:319`

**Interfaces:**
- Consumes: `tapCheckbox: (task: Task) => void` from `usePendingDone` (Task 2), already destructured in `calendar.tsx:57` as `const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);` — no new import needed.
- Produces: n/a (leaf UI wiring, nothing downstream depends on this).

- [ ] **Step 1: Update the checkbox `onPress` guard**

In `mobile/app/calendar.tsx`, find this line (currently line 319, inside the `renderItem` for the agenda `FlatList`, right after the `pending` variable is computed at line 308):

```tsx
                onPress={() => item.kind === 'incomplete' && tapCheckbox(item.task)}
```

Replace it with:

```tsx
                onPress={() => (item.kind === 'incomplete' || item.kind === 'completed') && tapCheckbox(item.task)}
```

- [ ] **Step 2: Confirm Day view needs no change**

Run: `grep -n "tapCheckbox" mobile/app/day/\[date\].tsx`
Expected output shows `tapCheckbox` called unconditionally (not gated behind a `kind`/`done` check) in both the all-day lane and the timed-pill checkbox handlers — confirming Task 2's hook change is sufficient there and no edit is needed in this file. If the grep instead shows a `!task.done` or similar guard around one of these call sites, stop and add a step here removing that guard before proceeding — do not silently skip Day view.

- [ ] **Step 3: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Run the mobile Jest suite one more time**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 88 passed, 88 total`.

- [ ] **Step 5: Run the full shared+console suite one more time**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, `0 fail`.

- [ ] **Step 6: Manual verification in the simulator**

Run: `mobile/scripts/sim.sh`

In the running app, on the Calendar screen:
1. Add a plain task (no priority, no recurrence) via the `+` button, then tap its checkbox to mark it done (wait for the 2.5s pending fill to commit).
2. Confirm it now shows as a `✓` completed row.
3. Tap its checkbox again.
4. Confirm it immediately reverts to an unchecked `□` incomplete row, and reopening it (tap the row, not the checkbox) in Task Detail shows the Done button again.
5. Repeat on the Day view for the same task to confirm it also toggles there.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/app/calendar.tsx
git commit -m "$(cat <<'EOF'
fix(calendar): make completed rows' checkbox tappable to undo (closes #68)

onPress was gated to item.kind === 'incomplete' only, so tapping a
done row's checkbox did nothing. Day view already called tapCheckbox
unconditionally, so this was the last wiring gap.
EOF
)"
```
