# Year + Day Views Design

**Date:** 2026-06-09

Two new calendar screens: a Year view (12-month overview with busy-day dots) and a Day view (timeline with timed events and all-day tasks). Year → tap a day → Day view. Day view also reachable from Focus (Week) section headers.

---

## Year View (`/year`)

### Layout
Vertically scrollable list of all 12 months for the current year. Header shows the year with ‹ › arrows to go to the previous/next year.

```
┌──────────────────────────────┐
│  2026              ‹    ›    │  ← header
├──────────────────────────────┤
│  JUNE                        │
│  S  M  T  W  T  F  S        │
│        1  2  3  4  5         │
│  6  7  8  •  10 11 12        │  ← dot under busy days
│  13 14 15 16 17 18 19        │
│  ...                         │
├──────────────────────────────┤
│  JULY                        │
│  ...                         │
└──────────────────────────────┘
```

### Day cells
Each cell is a small column: date number on top, busy dot below.

- **No tasks:** no dot (empty space preserved for alignment)
- **1–2 tasks:** 4px circle, accent color `#E8461A`, 45% opacity
- **3–5 tasks:** 6px circle, accent color, 70% opacity
- **6+ tasks:** 8px circle, accent color, 100% opacity

### Today
Today's date number has an accent-color square background (not a circle — Braun/Brutalist). Text is white.

### Past days
Days before today: date number color `#444` (dimmer). Busy dots still shown.

### Empty cells
Days before the 1st of the month (leading padding): rendered as blank cells with no number and no dot to keep the 7-column grid aligned.

### Busy count source
Count of non-done tasks where `task.start` date part equals the cell's date. Done tasks not counted (they're history).

### Tap a day
Navigates to `/day/YYYY-MM-DD`.

### Navigation
- Pressing ‹ goes to previous year, › goes to next year
- Page scrolls to today's month on first load

---

## Day View (`/day/[date]`)

Dynamic route — `date` param is `YYYY-MM-DD`.

### Header
```
‹ Year      MON  6/9      ‹  ›
```
- Left: `‹ Year` — calls `router.back()`
- Center: day label (`MON 6/9`, same format as Focus section headers but without year)
- Right: ‹ › arrows — `router.replace('/day/' + addDays(date, ±1))`

### All-day section
Tasks for this day that have no time component (`task.start` length === 10, i.e. `YYYY-MM-DD`). Shown in a flat list above the timeline, same row style as the Week screen (checkbox + title). Sorted by priority then line number.

### Timeline
- Hours shown: 6 AM – 10 PM (16 rows × 60px each = 960px fixed-height container)
- Implemented as a `ScrollView` with a single fixed-height `View` child; hour lines and tasks are **absolutely positioned** within it
- Auto-scrolls to current time minus 2 hours on mount (when viewing today), or to 8 AM otherwise

**Hour lines + labels:**
- Each hour: a full-width hairline border at `(hour - 6) * 60` from top
- Hour label: left-aligned at the same position, `JetBrains Mono` 10px, `#444`

**Timed task pills:**
- Positioned at `top: (taskHour - 6 + taskMinutes / 60) * 60`
- Left offset: 52px (past the hour labels), right: 8px
- Style: `#242424` background, 2px left border in `Colors.accent`, padding 4px 8px
- Content: time label (accent, 9px mono) + task title (white, 12px mono)
- Tasks without a time that somehow have a time component (edge case): treated as timed

**Current time line (today only):**
- Absolutely positioned at `top: (now.hours - 6 + now.minutes / 60) * 60`
- A 7px accent circle on the left + a full-width 1px accent line
- Only rendered when the date being viewed equals today

### Empty state
If no tasks and no events for the day:
```
nothing scheduled.
```
Centered, `JetBrains Mono`, `#444`, italic — shown in place of all-day section only if both all-day and timeline are empty.

---

## Navigation wiring

- `ViewSwitcher` VIEWS: add `{ label: 'Year', route: '/year' }` after Week
- `BottomActionBar` ROUTE_LABELS: add `'/year': 'Year'`
- `_layout.tsx`: add `<Stack.Screen name="year" />` and `<Stack.Screen name="day/[date]" />`
- Focus (Week) section headers: tapping the header text navigates to `/day/YYYY-MM-DD` for that section's date

---

## Files

- Create: `mobile/app/year.tsx`
- Create: `mobile/app/day/[date].tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/focus.tsx` (make section headers tappable)

---

## Out of scope

- Month view
- Event duration / time-block height (all timed items get a fixed-height pill)
- Editing tasks from the Day view (read-only; use swipe-to-done from the all-day section only)
- Recurring task expansion beyond what's already in `applyFocus`
