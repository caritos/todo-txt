# Search Due-Date Display Design

**Date:** 2026-08-01
**Status:** Approved

## Goal

GitHub issue (search screen, no due date shown): when searching, incomplete results with a `start:` date give no indication of when they're due — e.g. searching "eladio" shows `~eladio +sachem-dental-at-holbrook dental cleaning` with no date, forcing a tap into Task Detail just to see when the appointment is.

## Current state

`TaskRow` (`mobile/src/components/TaskRow.tsx`) already fully supports a `dateLabel` prop and an `isOverdue` prop — passing them renders a meta line under the title, with the same accent-red "↑ overdue" treatment used elsewhere in the app. But `TaskRow` has exactly one call site, `mobile/app/search.tsx`, and it never passes either prop. Calendar's agenda rows don't use `TaskRow` at all (they're a separate custom render), so this capability has effectively never been wired up anywhere.

Task Detail (`mobile/app/task/[line].tsx:75-76, 243-251`) already computes a canonical due date this way:
```ts
const occurrence = task.extensions['start'] ? taskOccurrence(task, todayStr) : null;
const dueDate = occurrence?.date ?? task.extensions['start']?.slice(0, 10);
```
and renders it via `formatDateLabel(dueDate)` (from `mobile/src/utils.ts`), with overdue styling gated on `!task.done && dueDate < todayStr`. This is the single source of truth for "what date is this task/event due" per CLAUDE.md, and must be reused as-is rather than re-derived.

## Scope

- Search results only (`mobile/app/search.tsx`). No changes to Calendar, Task Detail, or shared logic.
- Only tasks/events with a `start:` extension get a date shown; plain tasks with no date render unchanged.
- Completed results are unaffected — `TaskRow` already suppresses the meta line once `task.done` is true.
- Date + overdue styling only. Recurrence text (e.g. "every week") is explicitly out of scope: there is no existing function that turns a task's raw `frequency`/`every`/`frequency-day` extensions into display text (`recurrenceLabel()` in `RecurrencePicker.tsx` only formats the *picker's* in-memory editing state, not a saved task) — building that is new, separate work.

## Architecture

In `mobile/app/search.tsx`'s `renderItem`, for each result task compute:
```ts
const occurrence = item.extensions['start'] ? taskOccurrence(item, todayStr) : null;
const dueDate = occurrence?.date ?? item.extensions['start']?.slice(0, 10);
const dateLabel = dueDate ? formatDateLabel(dueDate) : undefined;
const isOverdue = !!(dueDate && !item.done && dueDate < todayStr);
```
and pass `dateLabel`/`isOverdue` into the existing `<TaskRow>` call. `taskOccurrence` comes from `@shared/commands/focus` (already used by Task Detail); `formatDateLabel` comes from `../src/utils` (already imported in `search.tsx` for `today`).

## Error Handling

None new — `taskOccurrence`/`formatDateLabel` are pure functions already exercised by Task Detail; no I/O or new failure modes introduced.

## Testing

No new automated test — consistent with this codebase's existing precedent of not unit-testing screen-level UI logic (`search.tsx` has no existing test file, and neither does `task/[line].tsx`, which uses the identical pattern). Verify manually via `sim.sh`: search for a dated task/event and confirm the date renders; search for an overdue one and confirm the accent-red styling matches Calendar's.

## Files Changed

| Action | File |
|---|---|
| Modify | `mobile/app/search.tsx` — compute and pass `dateLabel`/`isOverdue` per result row |
