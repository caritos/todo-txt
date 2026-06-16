# Calendar View Design

**Date:** 2026-06-16
**Issue:** #17
**Replaces:** Tasks view (`/done`) and Events view (`/events`)

## Overview

A single unified Calendar view — a fixed month grid on top with a swipeable month pager, and a scrollable daily agenda below. Tapping a date in the calendar jumps the agenda to that date. Swiping the calendar left/right changes the month and jumps the agenda to the 1st of that month.

## Layout

**Top — Month calendar (fixed height, ~260px)**
- Header: `MONTH YEAR` centered, no prev/next arrows (swipe to navigate)
- Day-of-week labels: SUN MON TUE WED THU FRI SAT
- 5–6 row date grid; empty leading/trailing cells are blank
- Dot indicator (accent color) below dates that have any items
- Today's date: accent-filled circle
- Selected date (tapped, not today): subtle highlight box
- Swipe left → next month; swipe right → previous month
- On month change: agenda scrolls to the first date in that month that has items; if the month has no items, scrolls to the nearest date before or after with items

**Bottom — Daily agenda (scrollable `FlatList` or `SectionList`)**
- Grouped by date; dates with no items are omitted
- Section header: `DOW MON DD` (e.g. `TUE JUN 16`) in small caps; today appends `— TODAY`
- Today's section has a subtle accent background tint (`Colors.accent + '11'`)
- Each row: icon + task/event title + optional time (right-aligned)
  - `○` incomplete task (accent color when overdue)
  - `✓` completed task (dimmed, strikethrough text)
  - `◆` event (accent color)
- Tapping a row navigates to `/task/[line]`
- On mount: list scrolls to today's section

**Synchronization**
- Tap calendar date → agenda `scrollToLocation` to that date's section
- Swipe calendar month → agenda jumps to first item in that month (or nearest date with items if month is empty)
- _(No reverse sync: scrolling the agenda does not update the calendar selection)_

## Data

**Completed tasks** — appear on their completion date (`task.completionDate`, the first date after `x`). Limit to last 90 days to keep the past from being infinite.

**Incomplete tasks** — appear on their `start:` date. Tasks with no `start:` date are omitted from the calendar agenda (they have no placement anchor).

**Events** — computed occurrences using the same `generateOccurrences` logic as the existing Events screen. Past occurrences (between 90 days ago and today) are shown on their scheduled date regardless of done status. Future occurrences up to 2 years out.

## Navigation Changes

**ViewSwitcher** (`src/components/ViewSwitcher.tsx`):
- Remove `{ label: 'Tasks', route: '/done' }` and `{ label: 'Events', route: '/events' }`
- Add `{ label: 'Calendar', route: '/calendar' }`

**BottomActionBar** (`src/components/BottomActionBar.tsx`):
- Add `'/calendar': 'Calendar'` to `ROUTE_LABELS`
- Remove `'/done'` and `'/events'` entries

**Files kept** — `app/done.tsx` and `app/events.tsx` remain on disk (they may be linked from deep links or task detail back-navigation) but are removed from the menu.

## New File

`mobile/app/calendar.tsx` — single screen, self-contained. Reuses `generateOccurrences` from `app/events.tsx` (extract to a shared helper or copy inline — keep it local to mobile layer).

## Design Tokens

Follows existing conventions: `Colors.background`, `Colors.accent`, `Colors.text`, `Colors.textSecondary`, `Colors.separator`, `Fonts.mono`. No new tokens needed.
