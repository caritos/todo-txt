# Tasks View Design

**Date:** 2026-06-15
**Status:** Approved

## Summary

Replace the "Done" view with a unified "Tasks" view that shows completed and incomplete tasks in a single scrollable list, with an inline Add Task input as the scroll anchor. The route stays `/done`; only the label and content change.

## Navigation Changes

- `ViewSwitcher.tsx`: `{ label: 'Done', route: '/done' }` → `{ label: 'Tasks', route: '/done' }`
- `BottomActionBar.tsx`: `'/done': 'Done'` → `'/done': 'Tasks'`

## Screen Layout (`/done` → `done.tsx`)

Single `ScrollView` with three logical zones, top to bottom:

### Zone 1 — Completed tasks (above anchor)

- Completed tasks from the last 30 days, grouped by completion date
- Section headers: date label (today / yesterday / weekday name) + count
- Each row: strikethrough title, completion date label, frequency if recurring
- Sorted most-recent-completion-date first (same as current done.tsx)
- Tapping a row navigates to `/task/[line]`

### Zone 2 — Add Task anchor (scroll target on mount)

- Inline `TextInput`: placeholder "add task…", same accent color as the rest of the app
- On submit: `buildAddRaw(text, todayStr)` → `save([...tasks, newTask])`, clear input
- A thin separator line above and below visually separates the zones

### Zone 3 — Incomplete tasks (below anchor)

- All non-done tasks, sorted by `start:` date ascending; tasks with no `start:` sort to the bottom
- Each row: empty checkbox, title (clean, no extensions), `start:` date label if present
- Tapping a row navigates to `/task/[line]`
- No section grouping — flat list

## Scroll Behavior

On mount, `ScrollView` scrolls to the Add Task anchor using `onLayout` on the anchor row + `scrollTo` in `useEffect`. This positions the user at the input with completed tasks reachable by scrolling up.

## What Stays

- The existing completed-task row style (strikethrough, muted colors) from current `done.tsx`
- The 30-day window for completed tasks
- `cleanTitle()` defined inline (same pattern as all other screens)

## Out of Scope

- Filtering/searching within the Tasks view
- Grouping incomplete tasks by date or project
- Any changes to the shared layer
