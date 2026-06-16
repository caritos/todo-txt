# Deferred Completion UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user taps a task checkbox, show a filled accent checkmark immediately, then commit the completion after 2.5 seconds; tapping again before the timer fires cancels it.

**Architecture:** A single `usePendingDone` hook owns all timer and pending-set logic. `done.tsx` (Tasks view) and `day/[date].tsx` (Day view) each call the hook and render different checkbox styles based on `isPending(line)`. No animation — instant visual state change on tap.

**Tech Stack:** React Native, React hooks (`useState`, `useRef`, `useEffect`, `useCallback`), `applyDone` from `@shared/commands/done`, existing `Colors` tokens.

---

### Task 1: Create `usePendingDone` hook

**Files:**
- Create: `mobile/src/hooks/usePendingDone.ts`

- [ ] **Step 1: Create the hook file**

Create `mobile/src/hooks/usePendingDone.ts` with:

```ts
import { useState, useRef, useEffect, useCallback } from 'react';
import type { Task } from '@shared/parser';
import { applyDone } from '@shared/commands/done';

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
          setPendingLines(prev => {
            const next = new Set(prev);
            next.delete(line);
            return next;
          });
          try {
            const { tasks: updated } = applyDone([...tasksRef.current], [line], todayStr);
            await save(updated);
          } catch {}
        }, delayMs);
        timers.current.set(line, timer);
      }
    },
    [todayStr, save, delayMs],
  );

  return { isPending, tapCheckbox };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "usePendingDone"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/usePendingDone.ts
git commit -m "feat(hooks): add usePendingDone — deferred checkbox completion with undo"
```

---

### Task 2: Wire `usePendingDone` into the Tasks view (`done.tsx`)

**Files:**
- Modify: `mobile/app/done.tsx`

#### Background

The incomplete task rows in `done.tsx` currently have a decorative `<View style={styles.cb} />` inside a `TouchableOpacity` that navigates to task detail. The checkbox is not tappable. We need to:
1. Import `applyDone` and `usePendingDone`
2. Call the hook
3. Wrap the checkbox in its own `TouchableOpacity`
4. Render the pending style (accent fill + ✓) when `isPending(task.line)`
5. Add the two new styles

In React Native, nested `TouchableOpacity` components work correctly — the inner one captures the tap and the outer row press does not fire.

- [ ] **Step 1: Update imports**

At the top of `mobile/app/done.tsx`, add two imports after the existing ones:

```ts
import { applyDone } from '@shared/commands/done';
import { usePendingDone } from '../src/hooks/usePendingDone';
```

The existing `taskOccurrence` import line is:
```ts
import { taskOccurrence } from '@shared/commands/focus';
```

Add after it:
```ts
import { applyDone } from '@shared/commands/done';
import { usePendingDone } from '../src/hooks/usePendingDone';
```

- [ ] **Step 2: Call the hook**

Inside `TasksScreen`, after the existing `const todayStr = today();` line, add:

```ts
const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
```

- [ ] **Step 3: Replace the checkbox in the incomplete task row**

Find this block inside the `incomplete.map(task => { ... })` render:

```tsx
                <View style={styles.cb} />
```

Replace with:

```tsx
                <TouchableOpacity onPress={() => tapCheckbox(task)} hitSlop={8}>
                  {isPending(task.line) ? (
                    <View style={styles.cbPending}>
                      <Text style={styles.cbCheck}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.cb} />
                  )}
                </TouchableOpacity>
```

- [ ] **Step 4: Add the two new styles**

In the `StyleSheet.create({...})` block, after the `cb` style definition, add:

```ts
  cbPending: {
    width: 17,
    height: 17,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbCheck: {
    fontSize: 11,
    color: '#ffffff',
    lineHeight: 13,
    fontWeight: '700',
  },
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | grep "done\.tsx"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/done.tsx
git commit -m "feat(tasks): deferred checkbox completion in Tasks view"
```

---

### Task 3: Wire `usePendingDone` into the Day view (`day/[date].tsx`)

**Files:**
- Modify: `mobile/app/day/[date].tsx`

#### Background

The Day view already has a working `handleDone` that calls `applyDone` immediately. We replace it with `tapCheckbox` from the hook. There are two places the checkbox appears:
1. All-day lane — uses `styles.cb` (17×17)
2. Timed pill — uses `styles.pillCb` (10×10), a smaller checkbox

Both get the same treatment but with size-appropriate glyphs.

- [ ] **Step 1: Add the hook import**

At the top of `mobile/app/day/[date].tsx`, add after the existing `applyDone` import:

```ts
import { usePendingDone } from '../../src/hooks/usePendingDone';
```

- [ ] **Step 2: Replace `handleDone` with the hook**

Find and delete the `handleDone` function:

```ts
  async function handleDone(task: Task) {
    try {
      const { tasks: updated } = applyDone([...tasks], [task.line], todayStr);
      await save(updated);
    } catch {}
  }
```

Replace it (in the same location, after the `useMemo` block) with:

```ts
  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
```

- [ ] **Step 3: Update the all-day lane checkbox**

Find the all-day lane checkbox (inside the non-event `TouchableOpacity`):

```tsx
                  <TouchableOpacity onPress={() => handleDone(task)} hitSlop={8}>
                    <View style={styles.cb} />
                  </TouchableOpacity>
```

Replace with:

```tsx
                  <TouchableOpacity onPress={() => tapCheckbox(task)} hitSlop={8}>
                    {isPending(task.line) ? (
                      <View style={styles.cbPending}>
                        <Text style={styles.cbCheck}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.cb} />
                    )}
                  </TouchableOpacity>
```

- [ ] **Step 4: Update the timed pill checkbox**

Find the pill checkbox inside the `{timed.map(...)}` block:

```tsx
                    <TouchableOpacity onPress={() => handleDone(task)} hitSlop={8}>
                      <View style={styles.pillCb} />
                    </TouchableOpacity>
```

Replace with:

```tsx
                    <TouchableOpacity onPress={() => tapCheckbox(task)} hitSlop={8}>
                      {isPending(task.line) ? (
                        <View style={styles.pillCbPending}>
                          <Text style={styles.pillCbCheck}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.pillCb} />
                      )}
                    </TouchableOpacity>
```

- [ ] **Step 5: Add new styles**

In the `StyleSheet.create({...})` block, after the `cb` and `pillCb` style definitions, add:

```ts
  cbPending: {
    width: 14,
    height: 14,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbCheck: {
    fontSize: 9,
    color: '#ffffff',
    lineHeight: 11,
    fontWeight: '700',
  },
  pillCbPending: {
    width: 10,
    height: 10,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCbCheck: {
    fontSize: 7,
    color: '#ffffff',
    lineHeight: 8,
    fontWeight: '700',
  },
```

Note: `cb` in the Day view is `14×14` (check the existing `styles.cb` — it's `{ width: 14, height: 14, ... }`), so `cbPending` matches that size.

- [ ] **Step 6: Remove unused `applyDone` import if no longer needed**

Check if `applyDone` is still used elsewhere in the file after removing `handleDone`. If the only usage was `handleDone`, remove the import:

```ts
import { applyDone } from '@shared/commands/done';
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/eladio/src/todo-txt/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: only pre-existing errors (none related to `day/[date].tsx`).

- [ ] **Step 8: Commit**

```bash
git add mobile/app/day/[date].tsx
git commit -m "feat(day): deferred checkbox completion in Day view"
```

---

### Task 4: Verify in simulator

- [ ] **Step 1: Build and run**

```bash
mobile/scripts/sim.sh
```

- [ ] **Step 2: Test Tasks view**

Navigate to the Tasks view. Tap a checkbox on any incomplete task:
- Checkbox should immediately fill with accent color and show ✓
- After ~2.5 seconds the task should disappear from the incomplete list and appear in the completed section

- [ ] **Step 3: Test undo in Tasks view**

Tap a checkbox, then tap it again within 2.5 seconds:
- Checkbox should return to the empty state
- No completion should occur

- [ ] **Step 4: Test Day view**

Navigate to a day with tasks (e.g., today). Tap a checkbox in the all-day lane:
- Same instant-fill behavior, then task disappears after 2.5 seconds

Tap the small pill checkbox on a timed task:
- Same behavior, smaller glyph

- [ ] **Step 5: Test undo in Day view**

Tap a pill/all-day checkbox, then tap again before 2.5 seconds:
- Reverts to empty, no completion fires

- [ ] **Step 6: Commit verification note**

```bash
git commit --allow-empty -m "chore: deferred completion verified in simulator"
```
