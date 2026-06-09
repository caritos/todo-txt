# Timeline View Design

**Date:** 2026-06-09

A 7-column week timeline screen (`/timeline`) modeled closely on Fantastical's Week view. All 7 days of the current week are visible simultaneously as columns, each showing timed tasks as absolutely-positioned pills at their correct hour/minute offset. Today's column has a subtle tint. A red current-time line spans the full width.

---

## Reference

`docs/fantastical/day-week-year-view/IMG_9157.PNG` — Fantastical's Week view.

---

## Route

`/timeline` — registered in `_layout.tsx`, added to `ViewSwitcher` (between Week and Year) and `BottomActionBar`.

---

## Layout

```
┌─────────────────────────────────────────┐
│  ‹   June 2026                      ›   │  ← header (month/year, week nav)
├─────────────────────────────────────────┤
│  SUN  MON  TUE  WED  THU  FRI  SAT     │  ← week strip (day name + number)
│   7    8   [9]   10   11   12   13      │    today = accent square
├─────────────────────────────────────────┤
│  all-day row: one cell per column       │  ← only shown if any all-day tasks exist
├──────┬────┬────┬────┬────┬────┬────┬───┤
│ 6 AM │    │    │    │    │    │    │   │
│ 7 AM │    │    │    │    │    │    │   │
│ 8 AM │    │████│    │    │    │    │   │  ← timed task pill in MON column
│ 9 AM │    │    │████│    │    │    │   │
│      ←────────────────────────────────→ │  ← current time line (red dot + bar)
│10 AM │    │    │    │    │    │    │   │
│ ...  │    │    │    │    │    │    │   │
│10 PM │    │    │    │    │    │    │   │
└──────┴────┴────┴────┴────┴────┴────┴───┘
```

---

## Header

- Large month + year label: `June` in `Colors.textSecondary`, `2026` in `Colors.accent` — matching the Fantastical style
- ‹ › arrows navigate to prev/next week
- Background: `Colors.navBar` (#111111)

---

## Week Strip

- 7 columns: SUN through SAT of the currently displayed week
- Each cell: day-name label (9px, `Colors.textSecondary`) above day number (14px)
- Today: accent square background (no border-radius — Braun/Brutalist), white text
- All other days: plain number, `Colors.text`
- Busy dots below day number: same 3-tier sizing as Year view (4px/6px/8px, counting non-done tasks with `start:` on that date)
- The week shown is Sun–Sat of whatever week contains the `anchorDate` state (defaults to today)

---

## All-Day Row

- Shown only when at least one column has all-day tasks (tasks whose `start:` is exactly 10 chars, no time component)
- One cell per day column, same width as timeline columns
- Each cell: stacks task titles as small compact chips (accent left border, 9px mono text, 1 line, truncated)
- If a day has no all-day tasks: empty cell (preserves column alignment)
- Row has a bottom separator (`Colors.separator`)

---

## Timeline

### Dimensions

- **Time label column:** 52px wide (same as Day view)
- **Day columns:** `(screenWidth - 52) / 7` each — approximately 48px on a 390px screen
- **Row height:** 60px per hour (`HOUR_HEIGHT = 60`)
- **Time range:** 6 AM – 10 PM (`START_HOUR = 6`, `END_HOUR = 22`) → 960px total height
- Wrapped in a `ScrollView` (vertical); the 960px container uses `position: 'relative'`

### Today's column highlight

- Today's column (when visible) has `backgroundColor: Colors.accent + '11'` (very subtle tint, ~7% opacity)
- Applied as a full-height absolutely-positioned `View` behind the events

### Hour lines

- Horizontal hairline at each hour: `top: (hour - START_HOUR) * HOUR_HEIGHT`
- Time label (52px wide, 10px mono, `#444`) at the left edge of each row
- Hour lines span the full width (all 7 columns)

### Current time line (today only)

- Absolutely positioned at `top: topOffset(now.getHours(), now.getMinutes())`
- 7px accent circle at left (after time label column) + full-width 1px accent bar
- Only rendered when the displayed week contains today

### Timed task pills

- For each day column, tasks with a time component in `start:` are positioned at their hour/minute offset
- `top: topOffset(hours, minutes) + 2`
- `left`: calculated as `LABEL_WIDTH + columnIndex * columnWidth + 2`
- `width`: `columnWidth - 4` (2px margin each side)
- Style: `backgroundColor: Colors.surface` (#242424), `borderLeftWidth: 2`, `borderLeftColor: Colors.accent`
- Content: `cleanTitle(task.text)` — 1 line, 10px mono, truncated
- Tasks outside 6 AM–10 PM range: not rendered

### Empty state

- If the entire week has no tasks (all-day or timed): show "nothing this week." centered below the strip, in place of the timeline

---

## Navigation

- `ViewSwitcher`: add `{ label: 'Timeline', route: '/timeline' }` between Week and Year
- `BottomActionBar` ROUTE_LABELS: add `'/timeline': 'Timeline'`
- `_layout.tsx`: add `<Stack.Screen name="timeline" />`

---

## State

```typescript
const [anchorDate, setAnchorDate] = useState(today()); // any date in the displayed week
```

- `weekStart`: Sunday of the week containing `anchorDate`
- `weekDates`: array of 7 YYYY-MM-DD strings (Sun–Sat)
- Prev week: `setAnchorDate(addDays(anchorDate, -7))`
- Next week: `setAnchorDate(addDays(anchorDate, 7))`
- Auto-scrolls to current time on mount when today is in the displayed week; otherwise scrolls to 8 AM

---

## Files

- Create: `mobile/app/timeline.tsx`
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/components/ViewSwitcher.tsx`
- Modify: `mobile/src/components/BottomActionBar.tsx`

---

## Out of scope

- Tapping a task pill (read-only view; use Week/Focus or Day view to interact)
- Event duration height (all timed tasks get a fixed ~26px pill regardless of duration)
- Multi-day spanning events
- Selecting a day in the strip (no single-day highlight — all 7 columns always visible)
