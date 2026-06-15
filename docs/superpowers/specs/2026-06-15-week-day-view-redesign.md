# Week & Day View Redesign

**Date:** 2026-06-15  
**Status:** Approved for implementation

## Goal

Replace the flat-list Week view with Fantastical-style 7-column time grid, add a Day view as a primary navigation destination, and introduce a shared selected-day concept so tapping a day in the WeekStrip context-sets the Day view.

---

## 1. Week View → 7-Column Time Grid

### What changes

- **Delete** `mobile/app/focus.tsx` (the flat day-grouped task list)
- **Rename** `mobile/app/timeline.tsx` → `mobile/app/focus.tsx` — this becomes the Week view, keeping the `/focus` route
- **Remove** "Timeline" from `ViewSwitcher` and `BottomActionBar` (it is now the Week view)
- **Remove** `<Stack.Screen name="timeline" />` from `_layout.tsx`

### Behavior

- Shows the current calendar week (Sun–Sat) as 7 columns in a scrollable time grid
- Tasks appear by their `start:` date — tasks with a date+time appear as pills at the correct hour; tasks with a date only appear in the all-day row
- **No overdue task pulling**: tasks only appear in the week they are scheduled — if a task's start date is in a past week, it does not appear in the current week view
- ‹/› header navigation moves to the previous/next week (existing behavior)
- Auto-scrolls to current hour − 2 on today's week, to 8 AM on other weeks (existing behavior)

### Selected day column highlight

- The selected day column in the time grid gets a gray background tint (`#2D2D2D`) extending the full height of the grid
- Today's column keeps its existing accent tint (`Colors.accent + '11'`)
- If selected === today, today's accent tint wins; no double highlight
- In the WeekStrip: selected day cell gets `#2D2D2D` background, day name rendered in `Colors.accent`; today's filled accent square is unchanged

---

## 2. Shared Selected Day State

### Where it lives

Add two fields to `TaskContext` (`mobile/src/context/TaskContext.tsx`):

```ts
selectedDate: string       // ISO date string, e.g. "2026-06-19"
setSelectedDate: (d: string) => void
```

- Initialized to `today()` on mount
- Persists in memory for the session (no storage)

### Who reads/writes it

| Component | Reads | Writes |
|-----------|-------|--------|
| WeekStrip (in focus.tsx) | to highlight selected cell | on day tap |
| ViewSwitcher "Day" entry | to build `/day/<selectedDate>` route | — |
| `day/[date].tsx` ‹/› nav | — | updates context on navigate |

---

## 3. WeekStrip Tap Behavior Change

**Before:** tapping a day scrolled the flat list to that day's section.  
**After:** tapping a day sets `selectedDate` in context. No scroll (there is no list to scroll).

The selected cell style:
```
background: #2D2D2D
day name color: Colors.accent
day number color: Colors.text (unchanged, slightly bolder)
```

Today's cell style (unchanged):
```
number box background: Colors.accent
number color: #ffffff, fontWeight 700
```

---

## 4. Day View as Primary Navigation

### ViewSwitcher entry

Add `{ label: 'Day', route: '/day/<selectedDate>' }` — but since routes are static strings in the `VIEWS` array, the ViewSwitcher's `navigate` function needs to read `selectedDate` from context at call time and construct the route dynamically.

Update `ViewSwitcher.tsx`:
- Import `useTasks` (or a new `useSelectedDate` accessor)
- Replace static "Day" route with: `router.push('/day/' + selectedDate)`

### BottomActionBar label

Add a wildcard match: any path starting with `/day/` → label "Day".

```ts
const label = pathname.startsWith('/day/') ? 'Day' : (ROUTE_LABELS[pathname] ?? 'Week');
```

### Day view navigation order in ViewSwitcher

```
Week → Day → Year → Done → Settings
```

---

## 5. Day View Visual Upgrade (`day/[date].tsx`)

The existing screen stays as-is structurally. Visual changes:

| Element | Before | After |
|---------|--------|-------|
| Header date format | `SUN  6/15` (small, monospaced) | `SUN  JUN 15` (clearer month name abbreviation) |
| Back button label | `‹ Year` (hardcoded) | `‹ Back` (generic — entry point varies) |
| Now-indicator | dot + line (keep) | unchanged |
| Hour label "12 PM" | `12 PM` | `noon` |

No layout changes. Compact nav bar retained.

---

## 6. Files Changed

| Action | File |
|--------|------|
| Delete | `mobile/app/focus.tsx` |
| Rename/replace | `mobile/app/timeline.tsx` → `mobile/app/focus.tsx` |
| Modify | `mobile/app/_layout.tsx` — remove `timeline` route |
| Modify | `mobile/src/context/TaskContext.tsx` — add `selectedDate` / `setSelectedDate` |
| Modify | `mobile/src/components/ViewSwitcher.tsx` — remove Timeline, add dynamic Day route |
| Modify | `mobile/src/components/BottomActionBar.tsx` — remove Timeline label, add Day wildcard |
| Modify | `mobile/app/day/[date].tsx` — back label, header format, "noon" label, write `selectedDate` on ‹/› |

---

## 7. Out of Scope

- Weather in the WeekStrip (Fantastical shows weather icons — we have no weather data)
- Event tap → detail navigation in Week grid (pills are not tappable in this iteration)
- Swipe-to-navigate-days gesture in Day view (‹/› buttons are sufficient)
