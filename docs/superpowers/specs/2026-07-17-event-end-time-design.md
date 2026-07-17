# Event End Time Design

**Date:** 2026-07-17
**Status:** Approved

## Goal

Let a user record what time an event *ends*, not just what time it starts — e.g. "team standup 9:00–9:30" or "conference Jul 20–22, ends 5:00 PM on the last day." GitHub issue #75. Works for both recurring and non-recurring events.

## Current state (why this doesn't work today)

- `start:` already carries an optional time (`start:2026-07-20T09:00`), consumed everywhere via `.slice(11, 16)`.
- `end:` exists but is **date-only** in every actual consumer — `shared/commands/focus.ts:270`, `:312`, `:577`, and `shared/commands/list.ts:75` all call `.slice(0, 10)` on it, discarding any time component. It represents a multi-day *span* (issue #70), not a time-of-day.
- README.md:91 documents `end:<date>` with an example (`end:2026-05-10T09:30`) that implies time support — this is stale/aspirational and doesn't match actual behavior; no code path reads or displays that time today. This gets corrected as part of this work.
- There is no UI anywhere (`AddTaskModal.tsx`, `task/[line].tsx`) to set an end *time*. The screenshot on issue #75 shows the user toggling on "End date" (multi-day) with the *same* date as Start, purely as a workaround attempt to find an end-time field — one doesn't exist.

## Scope

- Event-only (`addType === 'event'` in Add; `task.extensions['type'] === 'event'` in Task Detail) — end time is not a task concept, mirroring the existing task-only Priority / event-only End-date precedent.
- Works for **recurring and non-recurring events alike**. (Confirmed with user.) This is why it's a separate extension key rather than folding into `end:` — see "Storage format" below.
- Only appears once the event has a **start time** set (`hasTime` in Add; `start:` has a time component in Task Detail) — independent of the "End date" (multi-day) toggle. (Confirmed with user.)
- Auto-snap validation, no error state: picking an end time earlier than the start time (same calendar day) snaps it forward to equal the start time — same pattern as the existing End-date auto-snap. No overnight-spanning (end time "the next day") support; out of scope.
- Both Add and Edit get the UI. (Consistent with the End-date precedent.)

## Storage format: new `end-time:HH:MM`, decoupled from `end:`

Two options were considered:

1. **New `end-time:HH:MM` key** (chosen) — orthogonal to `end:` (which stays date-only, for multi-day span). An event's end time is "what time of day this ends," which is meaningful independent of which day(s) it spans.
2. Overload `end:` into a full datetime (`end:YYYY-MM-DDTHH:MM`), mirroring `start:`. Rejected: for a **recurring** event, `start:`'s date advances every cycle (`applyDone`), but nothing advances `end:`'s date — its date component would be permanently stale/meaningless the moment the event recurs past its first occurrence, and every reader would need to know to ignore it. A separate time-only key sidesteps this entirely: there's no date to go stale.

Examples:
```
pay rent start:2026-07-15 frequency:monthly
team standup start:2026-07-20T09:00 end-time:09:30 frequency:weekly frequency-day:M,W,F type:event
conference start:2026-07-20 end:2026-07-22 end-time:17:00 type:event
```

No parser change needed — extensions are already generically parsed as `key:value` (`shared/parser.ts`), and `applyAdd`/`applyEdit` don't validate or reject unknown keys.

## Architecture

### `AddTaskModal.tsx`: new "End time" row

New row in the Start-date group (`mobile/src/components/AddTaskModal.tsx:252-388`), positioned immediately after the existing **Time** row (lines 324-355), shown when `addType === 'event' && hasTime`. Same visual pattern as the Time row: `Switch` + compact `DateTimePicker` (`mode="time"`) + inline ✕ clear (`timeClear`/`timeClearText` styles, reused as-is).

New state: `hasEndTime: boolean`, `endTime: Date` (defaults to `new Date()`).

**Auto-snap**: when toggled on, default `endTime` to `time` (start time) + 1 hour. The end-time picker's `onChange` clamps to `>= time` on the same calendar day — if the user picks an end time before the current start time, snap it to equal start time. The start Time picker's existing `onTimeChange` additionally snaps `endTime` up to match whenever the new start time moves past the current end time (mirrors `onDateChange`'s existing snap-forward for `endDate` at line 150-154).

**Data flow**: `handleAdd()` (lines 111-148) pushes `end-time:${pad(endTime.getHours())}:${pad(endTime.getMinutes())}` into `parts`, right after the `start:`/`end:` push, only when `addType === 'event' && hasTime && hasEndTime`. This is independent of the existing `end:` push (line 123-124) — both can be present together (multi-day event with a specific end time on the final day) or either alone.

**Reset**: `reset()` (lines 82-97) additionally resets `hasEndTime` to `false` and `endTime` to `new Date()`.

**Turning off start Time**: when `hasTime` is switched off (existing `timeClear`/Switch-off handlers at lines 328, 348), also clear `hasEndTime` — an end time without a start time is meaningless, matching how turning off Start date already cascades to clear `hasTime`/`hasEnd` (lines 260-269).

### `task/[line].tsx`: new "End time" row, always-visible and immediately-saving

New row alongside the existing End Date section (lines 223-261), but with its **own** gating condition: `task.extensions['type'] === 'event' && !!task.extensions['start']?.includes('T')` — no frequency restriction (unlike End Date, which stays non-recurring-only). Positioned directly after the End Date block so both event-scheduling controls sit together.

New state: `hasEndTime: boolean`, `endTimeVal: Date`, both re-synced from `task.extensions['end-time']` in the existing `useEffect` (lines 36-44) that already re-syncs `hasEnd`/`endDate`.

**Immediate save**, following the exact `handleEndDateChange` pattern (lines 106-117) — reconstruct text via `applyEdit`, not the free-text edit flow:
```ts
async function handleEndTimeChange(timeStr: string | undefined) {
  if (!task) return;
  setHasEndTime(!!timeStr);
  const withoutEndTime = task.text.replace(/(?:^|\s)end-time:\S+/g, '').trim();
  const newText = timeStr ? `${withoutEndTime} end-time:${timeStr}` : withoutEndTime;
  try {
    const result = applyEdit([...tasks], lineNum, newText, todayStr);
    await save(result.tasks);
  } catch (e) {
    Alert.alert('Error', (e as Error).message);
  }
}
```
Time picker `onChange` clamps to the start time on the same calendar day, mirroring `onEndDateChange`'s clamp-to-start-date pattern (lines 119-128).

### Display: three call sites read `task.extensions['end-time']` directly

No shared-layer (`focus.ts`) change needed — end time is occurrence-date-independent (it's always "same day as whatever start/occurrence date is already being shown"), so each display site just reads the raw extension value alongside whatever start-time it already has.

**Calendar agenda (`mobile/app/calendar.tsx`)**: `AgendaItem` gets a new optional `endTime?: string` field (type at line 33-40). Only the event-occurrence block (lines 134-146) sets it — the 'incomplete' task loop already excludes typed/event tasks (line 114's `!!item.task.extensions['type']` guard), so tasks never carry one:
```ts
byDate.get(occ.date)!.push({
  key: `event-${t.line}-${occ.date}`,
  task: t,
  kind: 'event',
  time: t.extensions['start']?.slice(11, 16) || undefined,
  endTime: t.extensions['end-time'] || undefined,
});
```
Render (replacing line 351-352):
```tsx
) : item.time ? (
  <Text style={styles.agendaTime}>{item.time}{item.endTime ? ` - ${item.endTime}` : ''}</Text>
) : null}
```

**Task detail DUE row** (`mobile/app/task/[line].tsx:197-207`): append the same `" - HH:MM"` suffix when `task.extensions['end-time']` is set and `occurrence?.time` (or the raw start time) is present.

**Console** (`console/output.ts`, `formatFocusTask`, lines 73-113): extend the `when` string construction (lines 78-85) so that when `task.extensions['end-time']` is set and `timePart` is non-empty, append `-HH:MM` to `when` (e.g. `today 09:00-09:30`, `Mon Jul 20 09:00-09:30`).

### README.md

Fix the stale `end:<date>` row (line 91, currently implies time support that doesn't exist) to read "End date — date only, for multi-day spans," and add a new `end-time:<time>` row with an example, in the Scheduling Extensions table (lines 84-98).

## Error Handling

None new beyond what auto-snap already prevents. `handleEndTimeChange`'s `applyEdit` call can only fail the same ways any other edit can (save/write failure), handled by the existing `Alert.alert('Error', ...)` pattern used by every other action in `task/[line].tsx`.

## Testing

New cases in `console/tests/commands/focus.test.ts` (existing file, exercises `formatFocusTask` end-to-end via the CLI's `focus` command — see the existing `Dentist` case at lines 54-59 for the pattern) asserting on `stdout`:
- Event with `start:` time + `end-time:` set → stdout contains `HH:MM-HH:MM`.
- Event with `start:` time but no `end-time:` → stdout contains just `HH:MM`, no trailing `-HH:MM` (regression guard).
- Event with `end-time:` set but no `start:` time (malformed/hand-edited data) → no crash; `end-time:` is silently ignored (matches the scope rule that end time only applies when a start time exists).

Note: the existing `Dentist` test (line 56) already writes `end:${start}T10:00` — a datetime, not the date-only value `end:` actually supports. This is leftover from when README.md's stale docs implied `end:` carried time; the test only asserts the event *shows up*, never asserts on the (nonexistent) time-range display, so it isn't actually validating datetime support. Leave it as-is (out of scope to touch unrelated tests) but don't treat it as precedent that `end:` already handles time.

No new shared-layer tests needed — no shared-layer code changes in this design (unlike the End-date design, which touched `generateTaskOccurrences`).

No new mobile test coverage — consistent with this codebase's existing precedent of not unit-testing screen-level UI logic (`AddTaskModal.tsx` and `task/[line].tsx` have no existing test files).

## Files Changed

| Action | File |
|---|---|
| Modify | `mobile/src/components/AddTaskModal.tsx` — new End time row, auto-snap, reset, cascade-clear on Time off |
| Modify | `mobile/app/task/[line].tsx` — new End time row (always-visible, immediate-save, event + has-start-time only) |
| Modify | `mobile/app/calendar.tsx` — `AgendaItem.endTime`, event-occurrence population, agenda row range display |
| Modify | `console/output.ts` — `formatFocusTask`'s `when` string gets an end-time suffix |
| Modify | `console/tests/commands/focus.test.ts` — 3 new cases |
| Modify | `README.md` — fix stale `end:` doc, document new `end-time:` extension |
