# View Simplification Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Remove Day, Week, and Month views along with already-dead code discovered while tracing their references, leaving the app with three real screens: Calendar (default, agenda + built-in mini month-grid), Year (macro heatmap, now doubling as a "jump to a date" picker into Calendar), and Settings. Search remains as a utility screen.

## Motivation

The user only uses Calendar day-to-day. Calendar already embeds its own mini month-grid (`app/calendar.tsx:218-266` — prev/next month arrows, day labels, date cells with dots, tap-to-jump via `scrollToDate`), making the standalone Month view fully redundant. Day and Week add an intermediate drill-down layer neither Calendar nor Year need: Year currently taps a date into Day view, but Day's only other entry points are Week and Month, both being removed — so Day would be orphaned too. The simplification: Year hands its picked date to Calendar directly.

## Scope

### Deleted outright

- `app/day/[date].tsx` — Day view
- `app/timeline.tsx` — Week view
- `app/month.tsx` — Month view (superseded by Calendar's built-in mini-grid)
- `app/done.tsx` — already unreachable from any navigation (not in `ViewSwitcher`'s `VIEWS` list); found while tracing cross-references
- `app/events.tsx` — same: already unreachable, no `router.push('/events')` anywhere in the app
- `src/components/WeekStrip.tsx`, `src/components/MonthGrid.tsx`, `src/components/CalendarHeader.tsx` — not imported by any file (`grep -rln` for each name matches only the component's own file); leftover from an earlier design iteration, predates the current agenda-based Calendar/flex-grid Month implementations
- Two test blocks in `mobile/src/__tests__/uiUtils.test.ts`: `describe('topOffset regression (issue #25...'` and `describe('week view all-day section (issue #27...'` — both are self-contained (no imports from the deleted files) but exist purely to regression-test formulas that lived in Day/Week's rendering code, which no longer exists

### Explicitly not touched

- Search (`app/search.tsx`) and Settings (`app/settings.tsx`) remain as-is.
- `weekStart` config (`TaskContext`, Settings screen) is unaffected — still consumed by Calendar's mini-grid day-label ordering.
- Shared-layer occurrence logic (`generateTaskOccurrences`, `applyFocusForWindow`, etc.) is untouched — used by Calendar and by the CLI/console layer, unrelated to which mobile screens exist.

## Architecture

### `TaskContext`: rename `selectedDate` to a one-shot jump request

`selectedDate`/`setSelectedDate` (`src/context/TaskContext.tsx:15-16,27,68`) currently exist only so Day view, Week view, and `ViewSwitcher` can remember "which date to open Day view at." Once Day and Week are deleted, nothing reads it. Rather than deleting it outright, repurpose it as the Year→Calendar handoff, renamed so the one-shot contract is explicit rather than reusing an ambiguous "current selection" name:

```ts
// TaskContextValue
pendingDateJump: string | null;
requestDateJump: (date: string) => void;
clearDateJump: () => void;
```

Default state: `useState<string | null>(null)`.

### Year → Calendar handoff

`app/year.tsx:117` currently reads:
```ts
onPress={() => router.push(`/day/${dateStr}` as any)}
```
Changes to:
```ts
onPress={() => { requestDateJump(dateStr); router.push('/calendar'); }}
```
(`requestDateJump` destructured from `useTasks()` alongside the existing `tasks` at `year.tsx:28`.)

### Calendar consumes the jump

`app/calendar.tsx:53` destructures `{ tasks, save, weekStart }` from `useTasks()` — add `pendingDateJump, clearDateJump`. Capture the value once at the top of the component into a ref (matching the existing `tasksRef`-style pattern already used elsewhere in this codebase, e.g. `usePendingDone.ts`), since the context value will be cleared out from under it:

```ts
const jumpTargetRef = useRef(pendingDateJump);
```

- **Mini-grid initial month/year** (`calendar.tsx:61-63`, currently `useState(todayYear)` / `useState(todayMonth)` / `useState(todayStr)`): change the lazy initializers to prefer `jumpTargetRef.current` when set, falling back to today — e.g. `useState(() => jumpTargetRef.current ? parseInt(jumpTargetRef.current.slice(0, 4), 10) : todayYear)`, same pattern for month and for the local `selectedDate` (which stays as Calendar's own "highlighted mini-grid cell" state — unrelated to the renamed context field, no naming collision anymore).
- **Scroll target** (`calendar.tsx:184-189`, the mount `useEffect` that currently always scrolls to `todayStr` after a 200ms delay once `flatData` is populated): change the timer's target to `jumpTargetRef.current ?? todayStr`.
- **One-shot consumption**: in the same mount effect (or a sibling one that runs once), call `clearDateJump()` immediately so the context value doesn't linger — a later plain open of Calendar (bottom nav, app relaunch) always defaults to today, never re-jumping to a stale target. The ref keeps the *actual* scroll target stable for the 200ms-delayed `scrollToDate` call even though the context value is cleared synchronously.
- **Why a mount-time ref/lazy-state capture is safe here**: this relies on Calendar getting a fresh mount each time Year pushes `/calendar`, rather than an already-mounted background instance being refocused. That's the same mechanism the app already relies on today for Year/ViewSwitcher pushing a fresh `/day/${dateStr}` instance per date, and for `ViewSwitcher.navigate()` pushing every screen switch via `router.push` (never `router.replace`) — Expo Router's stack pushes a new instance per `push()` call rather than deduping by route name. This is an existing, already-relied-upon app behavior, not a new assumption introduced by this feature.

### Navigation entries

- `src/components/ViewSwitcher.tsx`'s `VIEWS` (currently `Calendar, separator, Day, Week, Month, Year, separator, Settings`) becomes `Calendar, separator, Year, separator, Settings`.
- `src/components/BottomActionBar.tsx`'s `ROUTE_LABELS` (currently `{ '/timeline': 'Week', '/month': 'Month', '/calendar': 'Calendar', '/settings': 'Settings' }`) drops the `/timeline`/`/month` entries, drops the `pathname.startsWith('/day/')` special case at `BottomActionBar.tsx:22`, and **adds `'/year': 'Year'`** — Year currently has no entry at all, so the bottom bar mislabels it as "Calendar" today (falls through to the `?? 'Calendar'` default). Fixing that is a natural side effect of touching this exact line for this exact reason, not scope creep.
- `app/_layout.tsx:33,35,37,38` — drop the `<Stack.Screen name="done">`, `<Stack.Screen name="events">`, `<Stack.Screen name="timeline">`, and `<Stack.Screen name="day/[date]">` entries. (There's no explicit entry for `month` today either, confirming these are optional bookkeeping — Expo Router auto-registers file-based routes regardless — but cleaning them up avoids referencing deleted files.)

### Docs

`CLAUDE.md`'s Repo Structure tree and Mobile Layer prose reference `timeline.tsx`, `month.tsx`, `day/[date].tsx`, `done.tsx`, `events.tsx`, `WeekStrip`, `MonthGrid`, `CalendarHeader`, and describe nav support for "Day, Week, Month" — all need updating to describe the resulting 3-screen app plus Search/Settings as utility screens. The many existing invariant notes that reference deleted files (e.g. "Day/week view filtering," "Week view pill layout," "Month view today cell," "Calendar navigation pattern" mentioning Month/Day taps) need removing or rewriting to match what remains.

## Error Handling

None new. `clearDateJump()`/`requestDateJump()` are synchronous state setters with no failure mode. If `jumpTargetRef.current` holds a malformed date string (shouldn't happen — Year only ever passes dates it generated itself the same way `todayStr` is generated), `scrollToDate` already no-ops safely today when `indexByDate.get(dateStr)` misses (`calendar.tsx:179-180`).

## Testing

No new automated tests — this is subtractive/wiring work over screen-level code this codebase doesn't unit-test (consistent with `calendar.tsx`'s existing precedent, and with the two stale test blocks being deleted rather than adapted). Verification:
- `tsc --noEmit` clean after all deletions and renames (catches any remaining reference to a deleted file/removed context field).
- Mobile Jest suite passes with the 2 stale blocks removed from `uiUtils.test.ts`.
- Manual simulator pass: open Year, tap a date, confirm Calendar opens scrolled to and with that date highlighted in the mini-grid; navigate away and back to Calendar via the bottom nav, confirm it now opens at today (one-shot consumed).

## Files Changed

| Action | File |
|---|---|
| Delete | `mobile/app/day/[date].tsx` |
| Delete | `mobile/app/timeline.tsx` |
| Delete | `mobile/app/month.tsx` |
| Delete | `mobile/app/done.tsx` |
| Delete | `mobile/app/events.tsx` |
| Delete | `mobile/src/components/WeekStrip.tsx` |
| Delete | `mobile/src/components/MonthGrid.tsx` |
| Delete | `mobile/src/components/CalendarHeader.tsx` |
| Modify | `mobile/src/context/TaskContext.tsx` — rename `selectedDate`/`setSelectedDate` to `pendingDateJump`/`requestDateJump`/`clearDateJump` |
| Modify | `mobile/app/year.tsx` — jump into Calendar instead of Day |
| Modify | `mobile/app/calendar.tsx` — consume `pendingDateJump` on mount |
| Modify | `mobile/src/components/ViewSwitcher.tsx` — drop Day/Week/Month entries |
| Modify | `mobile/src/components/BottomActionBar.tsx` — drop Day/Week/Month labels, add Year |
| Modify | `mobile/app/_layout.tsx` — drop Stack.Screen entries for deleted routes |
| Modify | `mobile/src/__tests__/uiUtils.test.ts` — remove the 2 stale test blocks |
| Modify | `CLAUDE.md` — update Repo Structure and Mobile Layer sections |
