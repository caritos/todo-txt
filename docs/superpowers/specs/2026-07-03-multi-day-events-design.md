# Multi-Day Events (End Date) Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Let a user create (and later edit) a single event that spans multiple consecutive days — e.g. "Nina's art class" from 2026-07-13 to 2026-07-17 — and have it actually render on every day of that span in Calendar. GitHub issue #70.

## Current state (why this doesn't work today)

- The todo.txt line format already parses an `end:` extension generically (no parser change needed), and it's read in three places for status/display purposes only: `shared/commands/focus.ts:270-271` (`isInFocusWindow` — keeps the task in the focus window while `end >= today`), `shared/commands/focus.ts:310-314` (`focusSortKey` — pins the display date to today while ongoing), and `shared/commands/list.ts:74-77` (`isPastEvent` — considers it "past" only once `end` elapses).
- The function Calendar actually uses to place event pills on specific dates, `generateTaskOccurrences` (`shared/commands/focus.ts:529-581`), **completely ignores `end:`**. For a non-recurring event (the `!freq` branch, lines 548-553) it pushes exactly one occurrence at `startDate` and returns. Even hand-editing a todo.txt line with `end:2026-07-17` today would not make it appear on the 14th–17th.
- There is no UI anywhere (`AddTaskModal.tsx`, `task/[line].tsx`) to set or edit `end:`. The user's only recourse was "Repeat: Every Day," which is semantically wrong — it makes the event recur forever on a daily cycle, not span 5 specific days once.

## Scope

- Event-only (`addType === 'event'` in the Add form; `task.extensions['type'] === 'event'` in Task Detail). Plain tasks aren't a "spans a date range" concept anywhere else in this app, mirroring the existing task-only Priority precedent.
- Non-recurring only. End date and Repeat are mutually exclusive — this is a one-time span, not a recurring pattern. (Confirmed with the user.)
- Both Add and Edit get the UI. (Confirmed with the user.)
- Auto-snap validation, no error state: the range can never become invalid, so there's nothing to reject. (Confirmed with the user.)

## Architecture

### Shared layer: expand `generateTaskOccurrences`'s non-recurring branch

`shared/commands/focus.ts:548-553` currently:
```ts
if (!freq) {
  if (startDate >= fromStr && startDate <= effectiveCutoff) {
    results.push({ date: startDate, task });
  }
  return results;
}
```
Becomes a day-by-day loop bounded by `effectiveCutoff` (same bound the recurring branch already uses at line 566, so a garbage far-future `end:` can't cause an unbounded loop — worst case is `effectiveCutoff - startDate` iterations, identical to today's recurring-loop cost):
```ts
if (!freq) {
  const spanEnd = task.extensions['end']?.slice(0, 10) ?? startDate;
  let cursor = startDate;
  while (cursor <= spanEnd && cursor <= effectiveCutoff) {
    if (cursor >= fromStr) results.push({ date: cursor, task });
    cursor = addDays(cursor, 1);
  }
  return results;
}
```
No `end:` → `spanEnd === startDate` → loop runs exactly once → identical behavior to today (regression-safe). This also fixes a latent related gap as a side effect: an event that already started before the query window (`startDate < fromStr`) but is still ongoing (`spanEnd >= fromStr`) now correctly shows on its remaining in-window days — today it wouldn't show at all in that case, for either single- or multi-day events.

No other shared-layer or parser change is needed — `end:` is already parsed for free, and `applyAdd`/`applyEdit` don't validate or reject unknown extensions.

### `AddTaskModal.tsx`: new "End date" row

New toggle + `DateTimePicker` (`mode="date"`, matching the existing Date row's pattern exactly) in the Start-date group (`mobile/src/components/AddTaskModal.tsx:239-334`), positioned between the existing **Date** row (262-271) and **Time** row (273-282). Shown only when `hasDate && addType === 'event'`.

New state: `hasEnd: boolean`, `endDate: Date`.

**Mutual exclusivity with Repeat**, enforced both directions:
- Toggling End date on sets `repeat` to `'none'` and hides the Repeat row for this session (Repeat row's existing conditional rendering gets `&& !hasEnd` added).
- Picking any Repeat value other than `'none'` (in the existing `RecurrencePicker`/`CustomRecurrencePicker` `onChange` handlers) sets `hasEnd` to `false`.

**Auto-snap validation** (no error UI): the End date picker's `onChange` clamps to `>= date` (the Start date) — if the user picks an end before the current start, snap it to equal start. The Start date picker's existing `onChange` (`onDateChange`, line 142-144) additionally snaps `endDate` up to match whenever the new start moves past the current end. The range can never become invalid.

**Data flow**: `handleAdd()` (`AddTaskModal.tsx:107-140`) pushes `end:${dateToISO(endDate)}` into `parts` immediately after the `start:` extension, only when `hasDate && hasEnd`.

**Reset**: `reset()` (lines 80-93) additionally resets `hasEnd` to `false` and `endDate` to `new Date()`.

### `task/[line].tsx`: new "End date" row, always-visible and immediately-saving

Task Detail already has two independent edit mechanisms: the title free-text box (toggled by the Edit/Save Edit button, `editing`/`editText`/`handleSaveEdit`) and always-visible structured controls that save immediately on change (currently just Priority, `task/[line].tsx:164-169`, decoupled entirely from `editing`). End date follows the **second** pattern, not the first — it must NOT be folded into the free-text `editText`/`handleSaveEdit` flow, since that would create two mechanisms racing to edit the same underlying `end:` token.

New row, shown when `task.extensions['type'] === 'event' && !task.extensions['frequency']` (event, non-recurring — matching the Add form's mutual-exclusivity rule), positioned alongside the Priority section (both are "always-visible structured extras," so adjacent placement reads consistently).

New state: `hasEnd: boolean`, `endDate: Date | undefined`, both re-synced from `task.extensions['end']` in the existing `useEffect` at lines 29-34 (which already re-syncs `editText`/`priority` from `task` whenever `!editing`).

**Immediate save mechanism** — mirrors `handlePriorityChange` (lines 69-84), which calls `applyPri`/`applyDepri` directly rather than going through `handleSaveEdit`. For End date, since there's no generic "set/clear one extension" shared function, reconstruct the full text and reuse `applyEdit`:
```ts
async function handleEndDateChange(dateStr: string | undefined) {
  setHasEnd(!!dateStr);
  const withoutEnd = task.text.replace(/(?:^|\s)end:\S+/g, '').trim();
  const newText = dateStr ? `${withoutEnd} end:${dateStr}` : withoutEnd;
  try {
    const result = applyEdit([...tasks], lineNum, newText, todayStr);
    await save(result.tasks);
  } catch (e) {
    Alert.alert('Error', (e as Error).message);
  }
}
```
This is safe because events never carry a priority (existing invariant), so `task.text` never has a `(A) ` prefix to worry about when reconstructing — unlike `handleSaveEdit`'s general case.

## Error Handling

None new beyond what auto-snap already prevents. `handleEndDateChange`'s `applyEdit` call can only fail the same ways any other edit can (e.g. save/write failure), handled by the existing `Alert.alert('Error', ...)` pattern already used by every other action in this file.

## Testing

New cases in `shared/tests/commands/focus.test.ts` for `generateTaskOccurrences`:
- A multi-day non-recurring event (`start:2026-07-13`, `end:2026-07-17`) expands to exactly 5 occurrences, one per day, inclusive of both endpoints.
- A single-day event (no `end:`) still returns exactly one occurrence — regression guard for the existing behavior.
- An event whose span is partially outside `[fromStr, cutoffStr]` (e.g. started before `fromStr`, or ends after `cutoffStr`) only returns the in-window days.
- A garbage far-future `end:` (e.g. `end:2099-01-01` with a `cutoffStr` 2 years out) returns occurrences only up to `effectiveCutoff`, not beyond — confirms the loop is bounded and doesn't run for decades.

No new mobile test coverage — consistent with this codebase's existing precedent of not unit-testing screen-level UI logic (`AddTaskModal.tsx` and `task/[line].tsx` have no existing test files).

## Files Changed

| Action | File |
|---|---|
| Modify | `shared/commands/focus.ts` — expand `generateTaskOccurrences`'s non-recurring branch |
| Modify | `shared/tests/commands/focus.test.ts` — add 4 new cases |
| Modify | `mobile/src/components/AddTaskModal.tsx` — new End date row, Repeat mutual exclusivity, auto-snap |
| Modify | `mobile/app/task/[line].tsx` — new End date row (always-visible, immediate-save, event+non-recurring only) |
