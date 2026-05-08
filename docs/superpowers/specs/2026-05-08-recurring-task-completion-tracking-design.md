# Recurring Task Completion Tracking

**Date:** 2026-05-08

## Problem

Recurring daily tasks appear in the focus list as "today" but cannot be marked done — the `done` command rejects them with "already complete" because the task's `done` flag is `true` from a prior occurrence. There is also no way to see whether today's occurrence has been completed, and no streak tracking.

## Goals

- Allow marking a recurring task done for today's occurrence
- Hide completed occurrences from the focus "today" view
- Show a streak count next to recurring tasks in focus
- Preserve full completion history in `listall` for streak analysis

## Data Model

Two writes happen when completing a recurring task:

**1. Completed copy appended to `todo.txt`** — a plain done record, no recurrence extensions:

```
x 2026-05-08 2026-05-08 stoicism
```

**2. `last-done:YYYY-MM-DD` added/updated on the original task**, which stays open (`done:false`):

```
stoicism start:2026-05-08T06:00 frequency:daily last-done:2026-05-08
```

The original task is never marked `x`. Streak lookup matches completed copies to originals by comparing base text (task text with all extensions stripped).

## `done` Command Behavior

Detection: a task is recurring if it has both `frequency` and `start` extensions.

| State | Action |
|---|---|
| `last-done` = today | Print "Already completed today for #N", skip |
| `last-done` < today or missing | Append completed copy, update `last-done:today` on original, print "Done: …" |
| `done:true` + `completionDate` < today (old data) | Same as above — also reset original to `done:false` (migrates old format) |
| Non-recurring, `done:true` | Existing: "Task #N is already complete." |
| Non-recurring, `done:false` | Existing: mark done |

## Streak Calculation

For each recurring task in focus:
1. Scan all `done` tasks; match those whose base text equals this task's base text
2. Collect their `completionDate` values into a set
3. Walk backwards from the most recent date:
   - For `frequency:daily` — step back 1 day per iteration
   - For `frequency:weekly` — step back 7 days (or `every:N` × 7)
   - For `frequency:monthly` — step back 1 month
   - For `frequency:yearly` — step back 1 year
4. Stop at the first gap; count = streak
5. If the most recent completion is older than one interval ago, streak = 0

Runs once per recurring task; O(n) over all tasks in the file.

## Focus Display Changes

**Filter**: Open recurring tasks where `last-done === today` are excluded. After completing, the task disappears from the "today" view naturally.

**Streak display**: Streak ≥ 2 is appended after the `↻` label in dim style as `×N`. Streak 0 or 1 shows nothing.

```
3404  today 06:00         stoicism  ↻ Sat May 9 06:00  ×12
3418  today 06:00         morning reflection  ↻ Sat May 9 06:00  ×5
3420  today 06:00         gospel  ↻ Sat May 9 06:00
3421  today 06:00         review rss feeds  ↻ Sat May 9 06:00  ×3
```

## Files Changed

| File | Change |
|---|---|
| `src/commands/done.ts` | Detect recurring tasks; create completed copy; update `last-done`; handle old `done:true` recurring tasks |
| `src/commands/focus.ts` | Filter `last-done === today`; compute streak per task; pass streak to `formatFocusTask` |
| `src/output.ts` | `formatFocusTask` gains optional `streak` param; appends `×N` when ≥ 2 |

No changes to `src/parser.ts`, `src/store.ts`, or other commands.
