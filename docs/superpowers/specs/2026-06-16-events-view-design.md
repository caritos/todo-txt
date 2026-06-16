# Events View Design

**Date:** 2026-06-16
**Status:** Approved
**GitHub:** #14

## Goal

A dedicated Events screen for browsing upcoming events — birthdays, anniversaries, one-off occasions — without task clutter. Primary use case: checking what's coming up across the next year and beyond.

## Screen

**Route:** `/events`
**File:** `mobile/app/events.tsx`

A `ScrollView` with month-year section headers (`JUNE 2026`, `JULY 2026`, …) and event rows beneath each header — the same visual rhythm as the completed-task date groups in the Tasks view (`done.tsx`).

### Row layout

```
[clean event title]                [DOW DD]
Birthday — Dad                      Thu 15
Team Offsite                        Mon 22
```

- Left: `cleanTitle(task.text)` — extensions stripped
- Right: day-of-week abbreviation + day number (e.g., `Thu 15`)
- No checkbox — events are read-only
- Tapping a row navigates to `/task/[line]` for detail, edit, or delete

### Section headers

Format: `MONTH YEAR` in uppercase, accent color, same style as date headers in the Tasks view.

### Empty state

`"no upcoming events."` — italic JetBrains Mono, centered, `Colors.textSecondary`.

## Data Computation

**Cutoff:** today + 2 years (computed as `addDays(todayStr, 730)`).

**Event detection:** `task.extensions['type']` is truthy.

**Occurrence generation** — for each event task, generate `{ date: string, task: Task }` pairs:

| Frequency | Logic |
|---|---|
| `yearly` | Call `nextYearlyDate` stepping forward from today until cutoff — typically 2 occurrences |
| `monthly` | Call `nextMonthlyDate` stepping forward until cutoff |
| `weekly` | Call `nextWeeklyDate` stepping forward until cutoff |
| none (one-off) | Include once if `start:` ≥ today and ≤ cutoff; skip if past |

Uses existing helpers from `@shared/commands/focus`: `nextYearlyDate`, `nextMonthlyDate`, `nextWeeklyDate`, `addDays`.

**Sort & group:** All pairs sorted by `date` ascending, then grouped by `YYYY-MM` for section headers.

## Navigation

Three one-line additions to existing files:

| File | Change |
|---|---|
| `mobile/src/components/ViewSwitcher.tsx` | Add `{ label: 'Events', route: '/events' }` between Tasks and Settings |
| `mobile/src/components/BottomActionBar.tsx` | Add `'/events': 'Events'` to the route label map |
| `mobile/app/_layout.tsx` | Register `<Stack.Screen name="events" />` |

## Visual Design

Follows existing design tokens — no new colors or type styles introduced.

| Element | Token |
|---|---|
| Background | `Colors.background` (`#1A1A1A`) |
| Section header text | `Colors.accent` (`#E8461A`), 11px, weight 700, letter-spacing 2 |
| Section header border | `Colors.separator` (`#333333`) |
| Row title | `Colors.text` (`#F0F0F0`), JetBrains Mono |
| Row date | `Colors.textSecondary` (`#888888`), JetBrains Mono |
| Row separator | `Colors.separator` |

## Files Changed

| Action | File |
|---|---|
| Create | `mobile/app/events.tsx` |
| Modify | `mobile/src/components/ViewSwitcher.tsx` |
| Modify | `mobile/src/components/BottomActionBar.tsx` |
| Modify | `mobile/app/_layout.tsx` |
