# Custom Repeat Design

**Date:** 2026-06-16
**Status:** Approved

## Goal

Add a "Custom ›" option to the Repeat picker in `AddTaskModal` that exposes a Fantastical-style drum-roll picker for arbitrary recurrence intervals, plus day-of-month and positional-weekday refinements for monthly tasks. Extend the shared recurrence engine so all generated extension strings behave correctly end-to-end.

## Approach

- Install `@react-native-picker/picker` for native iOS wheel spinners.
- New `CustomRecurrencePicker` component renders inline (no navigation push).
- Shared layer extended to respect `every:N` for monthly and yearly, and to advance `start:` on done for daily `every:N`.

## Data Model

### `CustomConfig` type

Exported from `mobile/src/components/RecurrencePicker.tsx`:

```typescript
export type CustomConfig = {
  n: number;                    // 1–52
  unit: 'day' | 'week' | 'month' | 'year';
  // Only when unit = 'month':
  monthDayType?: 'date' | 'positional';
  monthDate?: number;           // 1–31; 32 = "Last" → frequency-month-day:last-day
  positionOrdinal?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  positionWeekday?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
};
```

### Extension string mapping

| Config | Extension string |
|--------|-----------------|
| n=3, unit=week | `frequency:weekly every:3` |
| n=1, unit=month, monthDayType=date, monthDate=15 | `frequency:monthly frequency-month-day:15` |
| n=1, unit=month, monthDayType=date, monthDate=32 | `frequency:monthly frequency-month-day:last-day` |
| n=1, unit=month, monthDayType=positional, ordinal=first, weekday=monday | `frequency:monthly frequency-month-day:first-monday` |
| n=3, unit=month | `frequency:monthly every:3` |
| n=2, unit=year | `frequency:yearly every:2` |
| n=5, unit=day | `frequency:daily every:5` |

`monthDayType` and its sub-fields are ignored for unit ≠ month.

When `n === 1` and no month refinement is set, `every:` is omitted (same as the existing presets).

### `recurrenceLabel` update

```typescript
export function recurrenceLabel(value: RecurrenceValue, custom?: CustomConfig): string
```

For `value === 'custom'`, returns a short descriptive label built from `custom`:
- `n=3, unit=week` → `"Every 3 Wks"`
- `n=1, unit=month, monthDayType=date, monthDate=15` → `"Monthly · 15th"`
- `n=1, unit=month, monthDayType=positional, ordinal=first, weekday=monday` → `"Monthly · 1st Mon"`
- `n=1, unit=month` (no refinement) → `"Every Month"`
- `n=2, unit=year` → `"Every 2 Yrs"`
- `n=5, unit=day` → `"Every 5 Days"`

Falls back to `"Custom"` if `custom` is undefined.

## UI Components

### `RecurrencePicker.tsx` — minimal change

Add `'custom'` to `RecurrenceValue`:

```typescript
export type RecurrenceValue =
  | 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
```

Add as the last entry in OPTIONS:

```typescript
{ label: 'Custom ›', value: 'custom', extensions: '' }
```

`recurrenceExtensions('custom')` returns `''` — the caller builds the string from `CustomConfig`.

Tapping "Custom ›" calls `onChange('custom')`. The `AddTaskModal` detects `repeat === 'custom'` and renders `CustomRecurrencePicker` in place of `RecurrencePicker`.

### New `CustomRecurrencePicker.tsx`

Props:
```typescript
type Props = {
  config: CustomConfig;
  onChange: (c: CustomConfig) => void;
};
```

Internal state: `showOnDays: boolean`, `showOnWeek: boolean` (mutually exclusive).

**Layout (unit = month, nothing expanded):**
```
┌─────────────────────────────────────────────┐
│  every  [ 1 ▲]  [ month ▲]                 │  ← two Picker wheels
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  On Days                              15  › │
│  On Week                     first Mon   › │
└─────────────────────────────────────────────┘
```

**On Days expanded (unit = month):**

Replaces the On Days/On Week rows with a 4-column grid of touchable chips: 1–31 + Last (32). One selection at a time. Tapping a chip sets `monthDayType: 'date'`, `monthDate: N`, and clears `positionOrdinal`/`positionWeekday`. Tapping the selected chip again collapses without change.

**On Week expanded (unit = month):**

Replaces the On Days/On Week rows with two more horizontal Picker wheels:
- Left wheel: first / second / third / fourth / last
- Right wheel: Sunday / Monday / Tuesday / Wednesday / Thursday / Friday / Saturday

Selecting either wheel sets `monthDayType: 'positional'` and clears `monthDate`. Both wheels must have a value before the selection is considered complete (default: first / Monday).

**Visibility rules:**
- Both "On Days" and "On Week" rows are visible only when `config.unit === 'month'`.
- On Days and On Week are mutually exclusive — opening one collapses the other and clears its config fields.
- When unit changes away from month, `monthDayType`, `monthDate`, `positionOrdinal`, `positionWeekday` are all cleared.

**N picker range by unit:**
- day: 1–60
- week: 1–52
- month: 1–24
- year: 1–10

**`customRecurrenceExtensions(c: CustomConfig): string`** — pure function, exported from this file. Builds the extension string per the mapping table above.

### `AddTaskModal.tsx` changes

New state:
```typescript
const [customConfig, setCustomConfig] = useState<CustomConfig>({ n: 1, unit: 'month' });
```

Added to `reset()`:
```typescript
setCustomConfig({ n: 1, unit: 'month' });
```

In `handleAdd`, replace `recurrenceExtensions(repeat)` with:
```typescript
const freqExt = repeat === 'custom'
  ? customRecurrenceExtensions(customConfig)
  : recurrenceExtensions(repeat);
```

Repeat row value display:
```typescript
recurrenceLabel(repeat, repeat === 'custom' ? customConfig : undefined)
```

Repeat picker render: when `showRepeat && repeat === 'custom'`, render `<CustomRecurrencePicker config={customConfig} onChange={setCustomConfig} />` instead of `<RecurrencePicker>`.

When `repeat` changes away from `'custom'` (user goes back to a preset in the list), `customConfig` is left in place so it's preserved if the user switches back.

## Shared Layer Changes

### `shared/commands/focus.ts` — `nextMonthlyDate`

Add `every: number = 1` as the **last** parameter (after `frequencyMonthDay`), so existing call sites that don't pass `every` continue to work without change. Only call sites that need `every:N > 1` pass the new argument. When `every > 1`:

```
// Find the next occurrence month that is a multiple of `every` months from start
startYear  = start.year
startMonth = start.month
monthsSinceStart = (today.year - startYear) * 12 + (today.month - startMonth)
cycleIndex = max(0, ceil(monthsSinceStart / every))
targetMonth = startMonth + cycleIndex * every  // may be > 11; wrap with divmod
targetYear  = startYear + floor((startMonth + cycleIndex * every) / 12)
targetMonthNorm = (startMonth + cycleIndex * every) % 12

candidate = dayForMonth(targetYear, targetMonthNorm)
if candidate < today:
  advance by `every` more months and recompute
```

Call sites that need `every:N` pass the new arg explicitly; the rest are unchanged.

### `shared/commands/focus.ts` — `nextYearlyDate`

Add `every: number = 1` as the **last** parameter (after `frequencyMonthDay`). When `every > 1`, find the next year that is a multiple of `every` years from the start year:

```
yearsSinceStart = today.year - start.year
cycleIndex = max(0, ceil(yearsSinceStart / every))
targetYear = start.year + cycleIndex * every

candidate = same month/day as start but in targetYear
if candidate < today: targetYear += every
```

Update all call sites similarly.

### `shared/commands/done.ts` — daily `every:N`

Add `'daily'` to the frequency branch that advances `start:`:

```typescript
if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'yearly' || freq === 'daily')) {
```

For `freq === 'daily'`:
```
every = parseInt(task.extensions['every'] ?? '1')
startDate = startVal.slice(0, 10)
daysSinceStart = daysBetween(startDate, todayStr)
cycleIndex = max(0, ceil(daysSinceStart / every))
currentOcc = addDays(startDate, (cycleIndex - 1) * every)  // last occurrence on or before today
nextOcc    = addDays(currentOcc, every)
```

`nextOcc` becomes the new `start:` value. For `every:1` this advances start by 1 day (next day); for `every:5` by 5 days. The Tasks view filter (`start > todayStr → hide`) ensures the task stays hidden until its next occurrence date arrives.

### Tests

Add to `shared/tests/focus.test.ts`:
- `nextMonthlyDate` with `every=3` (quarterly): verify correct month skipping
- `nextYearlyDate` with `every=2` (biannual): verify correct year skipping

Add to `shared/tests/done.test.ts` (or existing done tests):
- `applyDone` on a `frequency:daily every:5` task: verify `start:` advances 5 days

## File Map

| File | Change |
|------|--------|
| `mobile/src/components/RecurrencePicker.tsx` | Add `'custom'` to `RecurrenceValue`; export `CustomConfig`; add Custom › to OPTIONS; update `recurrenceLabel` signature |
| `mobile/src/components/CustomRecurrencePicker.tsx` | **New** — drum-roll wheels, On Days grid, On Week wheels, `customRecurrenceExtensions()` |
| `mobile/src/components/AddTaskModal.tsx` | Add `customConfig` state + `reset()`; route 'custom' in `handleAdd` and repeat label; render `CustomRecurrencePicker` |
| `shared/commands/focus.ts` | Extend `nextMonthlyDate` + `nextYearlyDate` with `every` param; update all call sites |
| `shared/commands/done.ts` | Add daily `every:N` branch to start-advance block |
| `shared/tests/focus.test.ts` | New cases: monthly every:3, yearly every:2 |
| `shared/tests/done.test.ts` | New case: daily every:5 advances start |

## Out of Scope

- Weekday selection for weekly custom (e.g., "every 2 weeks on Mon and Wed") — `frequency-day` is already supported by the shared layer but adding that UI to Custom is deferred.
- Multiple day-of-month selections (e.g., 1st and 15th) — the shared layer only supports one `frequency-month-day` value.
- Notes, location, or reminder fields — not part of the todo.txt format.
