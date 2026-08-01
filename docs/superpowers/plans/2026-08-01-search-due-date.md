# Search Due-Date Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a due-date (and, if overdue, the accent-red overdue treatment) under each incomplete Search result that has a `start:` date, so the user doesn't have to tap into Task Detail just to see when something is due.

**Architecture:** `mobile/app/search.tsx` computes a per-row due date using the same `taskOccurrence` + `formatDateLabel` pattern Task Detail already uses, and passes it into `TaskRow`'s existing (currently unused) `dateLabel`/`isOverdue` props. No shared-layer or `TaskRow` changes — this is pure wiring.

**Tech Stack:** Expo Router / React Native, TypeScript, `@shared/commands/focus` (`taskOccurrence`), `mobile/src/utils.ts` (`formatDateLabel`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-search-due-date-design.md`
- Only tasks/events with a `start:` extension get a date shown; no change for undated tasks.
- Completed results are unaffected (TaskRow already suppresses meta line when `task.done`).
- No recurrence text — explicitly out of scope per spec.
- No new automated test file — matches this codebase's existing precedent of not unit-testing screen-level UI logic (`search.tsx`, `task/[line].tsx` have none). Verify via `tsc`, the existing Jest suite (regression), and manual check on-device/sim.

---

### Task 1: Wire due-date + overdue display into Search results

**Files:**
- Modify: `mobile/app/search.tsx`

**Interfaces:**
- Consumes: `taskOccurrence(task: Task, todayStr: string): { date: string; time: string | null } | null` from `@shared/commands/focus` (existing, used identically in `mobile/app/task/[line].tsx:75`). `formatDateLabel(dateStr: string): string` from `../src/utils` (existing, used identically in `mobile/app/task/[line].tsx:250`). `TaskRow`'s existing `dateLabel?: string` and `isOverdue?: boolean` props (`mobile/src/components/TaskRow.tsx:28,30`) — no changes to `TaskRow` itself.
- Produces: nothing consumed by other tasks — this is the only task.

- [ ] **Step 1: Add the two new imports**

In `mobile/app/search.tsx`, change:
```ts
import { today } from '../src/utils';
```
to:
```ts
import { today, formatDateLabel } from '../src/utils';
```
and add a new import line (grouped with the other `@shared` imports):
```ts
import { taskOccurrence } from '@shared/commands/focus';
```

- [ ] **Step 2: Compute `dateLabel`/`isOverdue` per row and pass them to `TaskRow`**

In `mobile/app/search.tsx`, inside the `<FlatList renderItem={({ item }) => ( ... )}>` block, replace:
```tsx
renderItem={({ item }) => (
  <TaskRow
    task={item}
    todayStr={todayStr}
    pending={isPending(item.raw)}
    onPress={() => router.push(`/task/${item.line}` as any)}
    onDone={() => handleDone(item.line)}
    onDelete={() => handleDelete(item.line)}
    onCheckboxPress={() => tapCheckbox(item)}
  />
)}
```
with:
```tsx
renderItem={({ item }) => {
  const occurrence = item.extensions['start'] ? taskOccurrence(item, todayStr) : null;
  const dueDate = occurrence?.date ?? item.extensions['start']?.slice(0, 10);
  const dateLabel = dueDate ? formatDateLabel(dueDate) : undefined;
  const isOverdue = !!(dueDate && !item.done && dueDate < todayStr);
  return (
    <TaskRow
      task={item}
      todayStr={todayStr}
      dateLabel={dateLabel}
      isOverdue={isOverdue}
      pending={isPending(item.raw)}
      onPress={() => router.push(`/task/${item.line}` as any)}
      onDone={() => handleDone(item.line)}
      onDelete={() => handleDelete(item.line)}
      onCheckboxPress={() => tapCheckbox(item)}
    />
  );
}}
```

This mirrors `mobile/app/task/[line].tsx:75-76` (`dueDate` derivation) and `:243-251` (overdue condition `!task.done && dueDate < todayStr`) exactly — same canonical due-date source, same overdue rule.

- [ ] **Step 3: Type-check**

Run: `cd mobile && npx tsc --noEmit -p .`
Expected: no new errors from `search.tsx`. (The pre-existing `recurrencePicker.test.ts` "Cannot find name 'jest'" errors are unrelated and already present on `main` — ignore them.)

- [ ] **Step 4: Run the existing Jest suite as a regression check**

Run: `cd mobile && npx jest`
Expected: all suites still pass (97/97 as of this plan's writing) — this change touches no logic any existing test exercises, so this is a pure no-regression check, not new coverage.

- [ ] **Step 5: Manual verification**

Build and install via `mobile/scripts/sim.sh` (interactive — the user runs this themselves, per this project's established local-build workflow). On the Search screen:
- Search for a task/event that has a `start:` date in the future (e.g. the `~eladio +sachem-dental-at-holbrook dental cleaning` task from the original report) → confirm a date now renders under the title, formatted like `Aug 15`.
- Search for something overdue (a task with `start:` in the past, not done) → confirm it renders with the same accent-red "↑ overdue" styling Calendar uses.
- Search for a plain undated task and a completed task → confirm both render unchanged (no date line).

- [ ] **Step 6: Commit**

```bash
cd /Users/eladio/src/todo-txt
git add mobile/app/search.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): show due date in Search results

Search results with a start: date now show the same due-date /
overdue styling Task Detail already computes, so a dated task or
event no longer requires a tap into detail just to see when it's
due.
EOF
)"
```
