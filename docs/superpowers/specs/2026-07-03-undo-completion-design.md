# Undo Completion Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Tapping the checkbox on an already-completed task should mark it not-done again — a toggle, symmetric with tapping the checkbox on an incomplete task. Currently it silently does nothing (GitHub issue #68).

## Scope

- Non-recurring tasks only. Recurring tasks (`frequency:` + `start:`) are out of scope this round — reversing an occurrence requires reconstructing the pre-completion `start:`/`last-done` state, which isn't recorded anywhere today. That's a separate, larger design.
- `mobile/app/calendar.tsx` — Calendar agenda's `kind: 'completed'` rows.
- `mobile/app/day/[date].tsx` — inherits the fix automatically (see below); no file change needed here beyond what the shared-layer/hook change already provides.

**Explicitly out of scope, left as today's no-op:**
- Task Detail (`mobile/app/task/[line].tsx`) — the Done button stays hidden once a task is done; no Undo button added.
- Search screen's swipe-to-done gesture (`TaskRow`'s `onDone`).
- `mobile/app/done.tsx` (the old Tasks view) — unreachable from `ViewSwitcher` navigation since Calendar became the default view; effectively dead code, not touched.
- All recurring-task occurrences (see Scope above).

## Architecture

### Shared layer: `applyUndone` in `shared/commands/done.ts`

Sibling to `applyDone`, following the existing `applyPri`/`applyDepri` one-pure-function-per-verb pairing convention (`shared/commands/pri.ts`).

```ts
export interface UndoneSkip {
  num: number;
  reason: 'not-done' | 'recurring-not-supported';
}

export function applyUndone(
  tasks: Task[],
  nums: number[],
): { tasks: Task[]; undone: Task[]; skipped: UndoneSkip[] }
```

For each line number, find the task:
- If it carries both `frequency` and `start` extensions → skip with `reason: 'recurring-not-supported'`. (Defensive: in practice a checkbox-driven recurring task's original line never has `done: true` — only its detached completed *copy* does, and that copy has no `frequency`/`start`, so it takes the normal path below. This guard only matters if a `frequency`+`start` task's `done` were ever true by some other means, e.g. manual file edit.)
- If `!task.done` → skip with `reason: 'not-done'` (nothing to undo).
- Otherwise: set `task.done = false`, `task.completionDate = undefined`, then `task.raw = serializeTask(task)`. Push onto `undone`.

Return shape mirrors `applyDone`'s `{ tasks, completed, copies, skipped }`, minus `copies` (irrelevant here): `{ tasks, undone, skipped }`.

**Known, unavoidable limitation:** `applyDone` already permanently strips priority on completion (`task.priority = undefined`), matching the todo.txt spec convention that completed tasks carry no priority. No previous-priority value is stored anywhere, so `applyUndone` cannot restore it — the task comes back priority-less. This is expected, not a bug to fix here.

**Note on recurring completed copies:** a recurring task's completed occurrence is a structurally plain `x DATE ... text` line with no `frequency`/`start`/`type` extensions (already fully detached from its originating series today — see `applyDone`'s recurring branch). `applyUndone` cannot distinguish such a copy from a genuine one-off completed task, and doesn't try to. Undoing one just makes it an ordinary incomplete task; it does not reconnect with or affect the recurring series it came from. This is consistent with the copy already being fully detached, not a new limitation introduced by this feature.

### Mobile layer: `usePendingDone` toggle

`mobile/src/hooks/usePendingDone.ts`'s `tapCheckbox(task)` currently only handles the incomplete → pending → done flow (2.5s delay, tap-again-to-cancel). Extend it to branch on `task.done`:

- `task.done === false` (existing behavior, unchanged): pending-delay flow calling `applyDone` after 2.5s, cancellable by a second tap within the window.
- `task.done === true` (new): call `applyUndone([...tasksRef.current], [task.line])` and `save(updated)` **immediately** — no pending-delay/grace-timer. The 2.5s window on the complete side exists so a batch of taps isn't over-committed while scrolling; a correction tap on an already-completed row is a single deliberate action, so instant feedback is simpler and matches the literal expectation in issue #68 ("when i press the checkbox... that task should be undone").

### `mobile/app/calendar.tsx`

Line ~319 currently reads:
```ts
onPress={() => item.kind === 'incomplete' && tapCheckbox(item.task)}
```
Change to also fire for completed rows:
```ts
onPress={() => (item.kind === 'incomplete' || item.kind === 'completed') && tapCheckbox(item.task)}
```

### `mobile/app/day/[date].tsx`

No change needed. Its checkboxes already call `tapCheckbox` unconditionally for any task (done or not), so once `usePendingDone` supports the done→undone branch, Day view inherits it automatically. This keeps Day view and Calendar consistent since both already share the same hook.

## Error Handling

If `applyUndone` or `save` throws, the row stays as-is (no optimistic UI change was made before the await, since there's no pending-delay step for undo). No toast or alert — consistent with the existing silent-failure handling for the complete-side `usePendingDone` path (see `2026-06-16-deferred-completion-design.md`).

If `applyUndone` returns a skip (recurring task, or already-not-done race), the tap is a no-op — same as today's behavior for those cases, not a regression.

## Testing

New cases in `shared/tests/commands/done.test.ts`:
- Undoes a plain done task: `done` becomes `false`, `completionDate` cleared, `raw` reconstructed via `serializeTask` with no completion prefix and no restored priority.
- No-ops with `reason: 'not-done'` when the task is already incomplete.
- No-ops with `reason: 'recurring-not-supported'` when the task carries both `frequency` and `start` extensions.

No new mobile test coverage — `calendar.tsx`'s agenda logic isn't extracted to a testable pure function (consistent with how the rest of that screen is structured; see the calendar-fix precedent in issue #67).

## Files Changed

| Action | File |
|---|---|
| Modify | `shared/commands/done.ts` — add `applyUndone` + `UndoneSkip` |
| Modify | `shared/tests/commands/done.test.ts` — add `applyUndone` cases |
| Modify | `mobile/src/hooks/usePendingDone.ts` — branch `tapCheckbox` on `task.done` |
| Modify | `mobile/app/calendar.tsx` — fire `tapCheckbox` for completed rows too |
