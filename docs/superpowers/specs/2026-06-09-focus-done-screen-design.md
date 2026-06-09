# Focus + Done Screen Design

**Date:** 2026-06-09
**Scope:** Two changes to the mobile app's Focus screen, plus a new Done screen.

---

## 1. Focus Screen — Item Count in Section Headers

### What changes
Each day section header in the Focus screen gets an item count on the right side, showing how many tasks/events fall on that day.

### Visual
```
TODAY   6/9/26                    4 items
TOMORROW   6/10/26                2 items
WED   6/11/26                     2 items
```

- Left: existing section title (unchanged — all-caps, `#888`, 10px, 2px letter-spacing)
- Right: `N items` or `1 item` — dim monospace (`#444`, `JetBrainsMono`, 10px)
- Both aligned to baseline on the same row

### Implementation
- In `focus.tsx`, the `sections` array already holds `data: FocusItem[]` per section
- Update `renderSectionHeader` to pass `section.data.length` and render the count on the right
- Singular: `1 item`, plural: `N items`
- Count includes both tasks and events (everything in `section.data`)

---

## 2. Done Screen — New View

### What it is
A new screen showing tasks completed in the last 30 days, grouped by completion date, accessible from the ViewSwitcher menu.

### Navigation
- Route: `/done`
- Added to `ViewSwitcher`'s `VIEWS` array after List, before Search
- `BottomActionBar`'s `ROUTE_LABELS` map gets `'/done': 'Done'`
- `_layout.tsx` gets a `<Stack.Screen name="done" />` entry

### Data
- Source: `tasks` from `TaskContext` (already loaded globally)
- Filter: `task.done === true && task.completionDate >= dateMinusDays(today, 29)` — "last 30 days" means today through 29 days ago inclusive
- Sort: most recent `completionDate` first, then by original `task.line` within the same day
- Grouping: by `task.completionDate` (YYYY-MM-DD)

### Section headers
Same pattern as Focus — same styles, same item count on the right:
```
TODAY   6/9/26                    3 done
YESTERDAY   6/8/26                2 done
FRI   6/7/26                      4 done
```
- "Today" / "Yesterday" labels follow the same `sectionHeader()` logic as Focus
- Count label: `N done` (not `N items`) to distinguish from the Focus screen

### Task rows
No `TaskRow` component — completed tasks are read-only, no swipe actions needed.

Each row:
- **Checkbox**: 17×17 filled square (`#333` bg, `#444` border), dim `✕` glyph inside (`#555`, 9px) — signals done, not actionable
- **Title**: `cleanTitle(task.text)` — same regex as `TaskRow.tsx` (`/(?:^|\s)[^\s:]+:[^\s/]\S*/g`) — in `JetBrainsMono` 13px, `#555`, strikethrough (`text-decoration-color: #444`)
- **Meta line**: just the day label ("today", "yesterday", "Fri") — the whole screen is already a done log so "completed" is redundant. If task has a `frequency` extension, append ` · daily` / ` · weekly` / ` · monthly` / ` · yearly`

### Empty state
If no tasks were completed in the last 30 days:
```
nothing done in the last 30 days.
```
Centered, `JetBrainsMono`, `#444`, italic.

### No calendar header
The Done screen has no `CalendarHeader` / week strip — it's a log, not a planner. The list starts directly below the status bar area.

### New file
`mobile/app/done.tsx` — self-contained screen, reads from `useTasks()`, no new shared-layer logic needed (filtering is a simple `Array.filter` on existing `Task` fields).

---

## Out of scope
- Weather info (not applicable to this app)
- Context tag labels on task rows
- Sorting/filtering the Done screen by project or context
- Pagination beyond 30 days
