# Month View Design

**Date:** 2026-06-15
**Status:** Approved

## Summary

Add a Month calendar view to the mobile app, accessible via the ViewSwitcher alongside the existing Day, Week, and Year views. The view shows a full month grid with task titles inline per day cell, matching the Fantastical-style navigation model.

## Scope

- New screen: `mobile/app/month.tsx`
- Update `mobile/src/components/ViewSwitcher.tsx`
- Update `mobile/src/components/BottomActionBar.tsx`
- No changes to shared layer, MonthGrid component, or other screens

## Month View (`/month`)

### Header

- Layout: `‹  JUNE 2026  ›`
- Month name in `Colors.textSecondary`, year in `Colors.accent`
- Left/right arrows navigate to previous/next month
- Matches the header style of `year.tsx`

### Calendar Grid

- 7 columns: S M T W T F S (day-of-week headers)
- One cell per calendar day; leading blank cells pad to the correct start day
- Cells fill rows completely (trailing blanks for the final week)

### Day Cell Contents

- **Date number** — top-left of cell
- **Task title** — one line, truncated, extensions stripped via `cleanTitle()` defined inline in `month.tsx` (same pattern as all other screens — it is not exported from a shared module)
- **Overflow count** — `"+N"` when the day has more than 1 non-done task with a matching `start:` date
- If a day has zero tasks: just the date number, no title or overflow label

### Visual State

- **Today**: accent-colored border on the cell (`Colors.accent`), date number in an accent-filled circle (white text)
- **Past days**: dimmed date text (`#444444`), same as Year view
- **Future days**: normal text color (`Colors.text`)

### Interaction

- Tapping any day cell navigates to `/day/[date]`

### Data

For each cell date, filter `tasks` where:
- `task.extensions['start']?.slice(0, 10) === dateStr`
- `!task.done`

Take the count; display the first task's `cleanTitle(task.text)` and `+N` overflow if count > 1.

No shared-layer changes needed — this is pure client-side filtering in the component.

## Navigation Changes

### ViewSwitcher (`ViewSwitcher.tsx`)

Updated `VIEWS` array order:

```
Day → Week → Month → Year → Done → Settings
```

Month entry: `{ label: 'Month', route: '/month' }`

### BottomActionBar (`BottomActionBar.tsx`)

Add to `ROUTE_LABELS`:

```ts
'/month': 'Month',
```

## Out of Scope

- Quarter view (removed — Year view is sufficient)
- Multi-month task spanning / event bars
- Pinch-to-zoom between views
- Any changes to shared layer or console layer
