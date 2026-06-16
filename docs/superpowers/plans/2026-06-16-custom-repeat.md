# Custom Repeat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Custom ›" repeat option to the AddTaskModal using native iOS wheel pickers (every N day/week/month/year), a day-of-month grid (On Days), and a positional-weekday picker (On Week), backed by a correct shared recurrence engine.

**Architecture:** Six tasks in dependency order. Shared layer first: add an `every: number = 1` parameter to the end of `nextMonthlyDate` and `nextYearlyDate` (backward-compatible default), update 16 call sites, and add a daily branch to `applyDone`. Then mobile: update `RecurrencePicker.tsx` with the new type and `CustomConfig`, create `CustomRecurrencePicker.tsx` (new component using `@react-native-picker/picker`), and wire both into `AddTaskModal.tsx`.

**Tech Stack:** Bun test runner (`bun test`), TypeScript with `import type` for type-only imports, `@react-native-picker/picker` (install via `npx expo install`), React Native, Expo SDK 52. Design tokens from `mobile/src/theme.ts`.

---

## File Map

| File | Change |
|------|--------|
| `shared/commands/focus.ts` | Add `every` param to `nextMonthlyDate` + `nextYearlyDate`; update 14 internal/external call sites |
| `shared/commands/done.ts` | Add daily branch; update monthly/yearly call sites to pass `every` |
| `shared/tests/commands/focus.test.ts` | Add 2 tests: `nextMonthlyDate` every:3, `nextYearlyDate` every:2 |
| `shared/tests/commands/done.test.ts` | Add 1 test: daily every:5 advances start |
| `mobile/src/components/RecurrencePicker.tsx` | Add `'custom'` to `RecurrenceValue`; export `CustomConfig`; add Custom › option; update `recurrenceLabel` signature |
| `mobile/src/components/CustomRecurrencePicker.tsx` | **New** — drum-roll wheels, On Days grid, On Week wheels, `customRecurrenceExtensions()` |
| `mobile/src/components/AddTaskModal.tsx` | Add `customConfig` state; route `'custom'` in `handleAdd` and label; render `CustomRecurrencePicker` |

---

## Task 1: Extend `nextMonthlyDate` with `every` param and update call sites

**Files:**
- Modify: `shared/commands/focus.ts`
- Modify: `shared/tests/commands/focus.test.ts`

### Background

Current signature (line 125):
```typescript
export function nextMonthlyDate(startStr: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
```

We add `every: number = 1` as the **last** parameter so all existing call sites that omit it still work with the default.

When `every > 1`, instead of finding the next calendar month, we find the next month that falls on a multiple of `every` months from `startStr`.

- [ ] **Step 1: Add a failing test for `nextMonthlyDate` with `every=3`**

Open `shared/tests/commands/focus.test.ts`. Add an import for `nextMonthlyDate`:

```typescript
import { taskOccurrence, nextMonthlyDate } from '../../commands/focus';
```

Then add this test inside a new `describe` block at the end of the file:

```typescript
describe('nextMonthlyDate with every', () => {
  test('every:3 — quarterly starting Jan 1, today is Apr 2', () => {
    // Jan 1 → Apr 1 → Jul 1 → Oct 1
    expect(nextMonthlyDate('2026-01-01', '2026-04-02', new Set(), undefined, 3)).toBe('2026-07-01');
  });

  test('every:3 — quarterly starting Jan 1, today is Apr 1 exactly', () => {
    expect(nextMonthlyDate('2026-01-01', '2026-04-01', new Set(), undefined, 3)).toBe('2026-04-01');
  });

  test('every:3 — quarterly starting Jan 15, today is Jan 10', () => {
    // Not yet reached first occurrence
    expect(nextMonthlyDate('2026-01-15', '2026-01-10', new Set(), undefined, 3)).toBe('2026-01-15');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun test shared/tests/commands/focus.test.ts
```

Expected: FAIL (argument count mismatch — `nextMonthlyDate` doesn't accept a 5th arg yet).

- [ ] **Step 3: Implement `nextMonthlyDate` with `every` support**

Replace the entire `nextMonthlyDate` function in `shared/commands/focus.ts` (lines 125–145) with:

```typescript
export function nextMonthlyDate(startStr: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string, every: number = 1): string {
  const t = new Date(todayStr + 'T12:00:00');

  function dayForMonth(year: number, month: number): number {
    const fmd = frequencyMonthDay ?? startStr.slice(8, 10);
    if (isNaN(Number(fmd))) return resolvePositionalDay(year, month, fmd);
    return parseInt(fmd);
  }

  if (every > 1) {
    const startDate = new Date(startStr.slice(0, 10) + 'T12:00:00');
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const monthsSinceStart = (t.getFullYear() - startYear) * 12 + (t.getMonth() - startMonth);
    const cycleIndex = Math.max(0, Math.ceil(monthsSinceStart / every));
    const absMonth = startMonth + cycleIndex * every;
    const tYear = startYear + Math.floor(absMonth / 12);
    const tMonth = absMonth % 12;
    let candidate = new Date(tYear, tMonth, dayForMonth(tYear, tMonth));
    if (candidate < t) {
      const nextAbs = absMonth + every;
      const nYear = startYear + Math.floor(nextAbs / 12);
      const nMonth = nextAbs % 12;
      candidate = new Date(nYear, nMonth, dayForMonth(nYear, nMonth));
    }
    const result = isoDate(candidate);
    if (exdates.has(result)) return nextMonthlyDate(startStr, addDays(result, 1), exdates, frequencyMonthDay, every);
    return result;
  }

  let year = t.getFullYear();
  let month = t.getMonth();
  let candidate = new Date(year, month, dayForMonth(year, month));
  if (candidate < t) {
    month++;
    if (month > 11) { month = 0; year++; }
    candidate = new Date(year, month, dayForMonth(year, month));
  }
  const result = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
  if (exdates.has(result)) return nextMonthlyDate(startStr, addDays(result, 1), exdates, frequencyMonthDay, every);
  return result;
}
```

- [ ] **Step 4: Update the 6 external call sites for `nextMonthlyDate` in `focus.ts`**

Each call site gains `parseInt(task.extensions['every'] ?? '1')` (or `parseInt(t.extensions['every'] ?? '1')` where the variable is named `t`) as the final argument. Make the following replacements:

**Line ~226** (inside `isInFocusWindow`, event/type branch):
```typescript
// Before:
return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) <= windowEnd;
// After:
return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1')) <= windowEnd;
```

**Line ~243** (inside `isInFocusWindow`, task branch):
```typescript
// Before:
const next = nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']);
// After:
const next = nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1'));
```

**Line ~272** (inside `focusSortKey`, event branch):
```typescript
// Before:
if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
// After:
if (frequency === 'monthly') return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1')) + time;
```

**Line ~298** (inside `focusSortKey`, task branch):
```typescript
// Before:
return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day']) + time;
// After:
return nextMonthlyDate(start, todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1')) + time;
```

**Line ~354** (inside `focusNextRecurrence`):
```typescript
// Before:
else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent, exdates, task.extensions['frequency-month-day']);
// After:
else if (frequency === 'monthly') nextDate = nextMonthlyDate(start, afterCurrent, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1'));
```

**Line ~428** (inside `applyFocusForWindow`, `effToday` closure — variable is named `t`):
```typescript
// Before:
if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr, exdates, t.extensions['frequency-month-day']), 1);
// After:
if (freq === 'monthly') return addDays(nextMonthlyDate(start, todayStr, exdates, t.extensions['frequency-month-day'], parseInt(t.extensions['every'] ?? '1')), 1);
```

- [ ] **Step 5: Run tests**

```bash
bun test shared/tests/commands/focus.test.ts
```

Expected: all tests pass including the 3 new quarterly tests.

- [ ] **Step 6: Commit**

```bash
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "feat(shared): extend nextMonthlyDate with every:N interval support"
```

---

## Task 2: Extend `nextYearlyDate` with `every` param and update call sites

**Files:**
- Modify: `shared/commands/focus.ts`
- Modify: `shared/tests/commands/focus.test.ts`

### Background

Current signature (line 51):
```typescript
export function nextYearlyDate(start: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string): string {
```

We add `every: number = 1` at the end.

- [ ] **Step 1: Add a failing test for `nextYearlyDate` with `every=2`**

Add an import for `nextYearlyDate` to the test file import line:

```typescript
import { taskOccurrence, nextMonthlyDate, nextYearlyDate } from '../../commands/focus';
```

Add to the new describe block from Task 1:

```typescript
describe('nextYearlyDate with every', () => {
  test('every:2 — biannual starting Jan 1 2024, today is Jan 2 2026', () => {
    // Occurrences: 2024-01-01, 2026-01-01, 2028-01-01 — next after Jan 2 2026 is 2028
    expect(nextYearlyDate('2024-01-01', '2026-01-02', new Set(), undefined, 2)).toBe('2028-01-01');
  });

  test('every:2 — biannual starting Jan 1 2024, today is Jan 1 2026 exactly', () => {
    expect(nextYearlyDate('2024-01-01', '2026-01-01', new Set(), undefined, 2)).toBe('2026-01-01');
  });

  test('every:2 — biannual starting Jan 1 2024, today is Jan 1 2025', () => {
    // Between occurrences — next is 2026
    expect(nextYearlyDate('2024-01-01', '2025-01-01', new Set(), undefined, 2)).toBe('2026-01-01');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test shared/tests/commands/focus.test.ts
```

Expected: FAIL (5th arg not accepted).

- [ ] **Step 3: Implement `nextYearlyDate` with `every` support**

Replace the `nextYearlyDate` function (lines 51–67) with:

```typescript
export function nextYearlyDate(start: string, todayStr: string, exdates: Set<string> = new Set(), frequencyMonthDay?: string, every: number = 1): string {
  const month0 = parseInt(start.slice(5, 7)) - 1;
  const startYear = parseInt(start.slice(0, 4));
  const thisYear = parseInt(todayStr.slice(0, 4));

  function occurrenceForYear(year: number): string {
    if (frequencyMonthDay && isNaN(Number(frequencyMonthDay))) {
      const day = resolvePositionalDay(year, month0, frequencyMonthDay);
      return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${year}-${start.slice(5, 10)}`;
  }

  if (every > 1) {
    const yearsSinceStart = thisYear - startYear;
    const cycleIndex = Math.max(0, Math.ceil(yearsSinceStart / every));
    let targetYear = startYear + cycleIndex * every;
    let occ = occurrenceForYear(targetYear);
    if (occ < todayStr) {
      targetYear += every;
      occ = occurrenceForYear(targetYear);
    }
    if (exdates.has(occ)) return nextYearlyDate(start, addDays(occ, 1), exdates, frequencyMonthDay, every);
    return occ;
  }

  const thisOccurrence = occurrenceForYear(thisYear);
  const result = thisOccurrence >= todayStr ? thisOccurrence : occurrenceForYear(thisYear + 1);
  if (exdates.has(result)) return nextYearlyDate(start, addDays(result, 1), exdates, frequencyMonthDay);
  return result;
}
```

- [ ] **Step 4: Update the 6 external call sites for `nextYearlyDate` in `focus.ts`**

**Line ~220** (inside `isInFocusWindow`, event/type branch):
```typescript
// Before:
const next = nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
// After:
const next = nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1'));
```

**Line ~247** (inside `isInFocusWindow`, task branch):
```typescript
// Before:
return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']) <= windowEnd;
// After:
return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1')) <= windowEnd;
```

**Line ~270** (inside `focusSortKey`, event branch):
```typescript
// Before:
if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']);
// After:
if (frequency === 'yearly') return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1'));
```

**Line ~306** (inside `focusSortKey`, task branch):
```typescript
// Before:
return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day']) + time;
// After:
return nextYearlyDate(start.slice(0, 10), todayStr, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1')) + time;
```

**Line ~355** (inside `focusNextRecurrence`):
```typescript
// Before:
else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent, exdates, task.extensions['frequency-month-day']);
// After:
else if (frequency === 'yearly') nextDate = nextYearlyDate(start.slice(0, 10), afterCurrent, exdates, task.extensions['frequency-month-day'], parseInt(task.extensions['every'] ?? '1'));
```

**Line ~429** (inside `applyFocusForWindow`, `effToday` closure — variable is `t`):
```typescript
// Before:
if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr, exdates, t.extensions['frequency-month-day']), 1);
// After:
if (freq === 'yearly') return addDays(nextYearlyDate(start.slice(0, 10), todayStr, exdates, t.extensions['frequency-month-day'], parseInt(t.extensions['every'] ?? '1')), 1);
```

- [ ] **Step 5: Run tests**

```bash
bun test shared/tests/commands/focus.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "feat(shared): extend nextYearlyDate with every:N interval support"
```

---

## Task 3: Add daily `every:N` branch to `applyDone` and update monthly/yearly call sites

**Files:**
- Modify: `shared/commands/done.ts`
- Modify: `shared/tests/commands/done.test.ts`

### Background

`applyDone` currently advances `start:` for weekly, monthly, and yearly. For daily, the task reappears the next day via the `last-done` mechanism without advancing `start:`. With `frequency:daily every:N`, we must advance `start:` by N days so the task only reappears after N days, not the next day.

The `every` variable is already computed at line 65 of `done.ts`:
```typescript
const every = parseInt(task.extensions['every'] ?? '1');
```

- [ ] **Step 1: Add failing test for daily every:5**

Add to `shared/tests/commands/done.test.ts`:

```typescript
test('applyDone on daily every:5 task advances start by 5 days', () => {
  // Occurrences: Jan 1, Jan 6, Jan 11, Jan 16...
  // Marking done on Jan 11: currentOcc=Jan 11, nextOcc=Jan 16
  const tasks = [makeTask('water plants start:2026-01-01 frequency:daily every:5')];
  const { tasks: updated } = applyDone(tasks, [1], '2026-01-11');
  expect(updated[0]!.extensions['start']).toBe('2026-01-16');
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test shared/tests/commands/done.test.ts
```

Expected: FAIL — start is not advanced for daily tasks.

- [ ] **Step 3: Update `applyDone` in `done.ts`**

**Change 1:** Extend the frequency condition at line 64 to include daily:

```typescript
// Before:
if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'yearly')) {
// After:
if (startVal && (freq === 'weekly' || freq === 'monthly' || freq === 'yearly' || freq === 'daily')) {
```

**Change 2:** Add the daily branch and pass `every` to monthly and yearly. Replace the `if (freq === 'weekly') ... else if (freq === 'monthly') ... else { yearly }` block (lines 71–80) with:

```typescript
if (freq === 'weekly') {
  currentOcc = nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
  nextOcc = nextWeeklyDate(startVal, addDays(currentOcc, 1), every, exdates, freqDay);
} else if (freq === 'monthly') {
  currentOcc = nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
  nextOcc = nextMonthlyDate(startVal, addDays(currentOcc, 1), exdates, freqMonthDay, every);
} else if (freq === 'daily') {
  const startDate = startVal.slice(0, 10);
  const startMs = new Date(startDate + 'T12:00:00').getTime();
  const todayMs = new Date(todayStr + 'T12:00:00').getTime();
  const daysSinceStart = Math.round((todayMs - startMs) / 86400000);
  const cycles = daysSinceStart <= 0 ? 0 : Math.ceil(daysSinceStart / every);
  currentOcc = addDays(startDate, cycles * every);
  nextOcc = addDays(currentOcc, every);
} else {
  currentOcc = nextYearlyDate(startVal.slice(0, 10), todayStr, exdates, freqMonthDay, every);
  nextOcc = nextYearlyDate(startVal.slice(0, 10), addDays(currentOcc, 1), exdates, freqMonthDay, every);
}
```

- [ ] **Step 4: Run all shared tests**

```bash
bun test
```

Expected: all tests pass. The existing weekly test in `done.test.ts` should still pass.

- [ ] **Step 5: Commit**

```bash
git add shared/commands/done.ts shared/tests/commands/done.test.ts
git commit -m "feat(shared): advance start for daily every:N on applyDone; pass every to monthly/yearly"
```

---

## Task 4: Update `RecurrencePicker.tsx` — add `'custom'`, `CustomConfig`, and update `recurrenceLabel`

**Files:**
- Modify: `mobile/src/components/RecurrencePicker.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export type RecurrenceValue =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

export type CustomConfig = {
  n: number;
  unit: 'day' | 'week' | 'month' | 'year';
  monthDayType?: 'date' | 'positional';
  monthDate?: number; // 1–31; 32 = Last → frequency-month-day:last-day
  positionOrdinal?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  positionWeekday?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
};

const OPTIONS: { label: string; value: RecurrenceValue; extensions: string }[] = [
  { label: 'Never', value: 'none', extensions: '' },
  { label: 'Every Day', value: 'daily', extensions: 'frequency:daily' },
  { label: 'Every Week', value: 'weekly', extensions: 'frequency:weekly' },
  { label: 'Every 2 Weeks', value: 'biweekly', extensions: 'frequency:weekly every:2' },
  { label: 'Every Month', value: 'monthly', extensions: 'frequency:monthly' },
  { label: 'Every Year', value: 'yearly', extensions: 'frequency:yearly' },
  { label: 'Custom ›', value: 'custom', extensions: '' },
];

export function recurrenceExtensions(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.extensions ?? '';
}

export function recurrenceLabel(value: RecurrenceValue, custom?: CustomConfig): string {
  if (value === 'custom') {
    if (!custom) return 'Custom';
    const unitParts: Record<CustomConfig['unit'], [string, string]> = {
      day: ['Day', 'Days'],
      week: ['Wk', 'Wks'],
      month: ['Mo', 'Mos'],
      year: ['Yr', 'Yrs'],
    };
    if (custom.unit === 'month') {
      if (custom.monthDayType === 'date' && custom.monthDate) {
        const d = custom.monthDate;
        if (d === 32) return 'Monthly · Last';
        const suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
        return `Monthly · ${d}${suffix}`;
      }
      if (custom.monthDayType === 'positional' && custom.positionOrdinal && custom.positionWeekday) {
        const ords: Record<NonNullable<CustomConfig['positionOrdinal']>, string> = {
          first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'Last',
        };
        const days: Record<NonNullable<CustomConfig['positionWeekday']>, string> = {
          sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
          thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
        };
        return `Monthly · ${ords[custom.positionOrdinal]} ${days[custom.positionWeekday]}`;
      }
    }
    const [sing, plur] = unitParts[custom.unit];
    return `Every ${custom.n} ${custom.n === 1 ? sing : plur}`;
  }
  return OPTIONS.find(o => o.value === value)?.label ?? 'Never';
}

type Props = {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
};

export function RecurrencePicker({ value, onChange }: Props) {
  return (
    <View>
      {OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, opt.value === value && styles.optionSelected]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, opt.value === value && styles.optionTextSelected]}>
            {opt.label}
          </Text>
          {opt.value === value && opt.value !== 'custom' && (
            <Text style={styles.check}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  optionSelected: { backgroundColor: Colors.accent + '11' },
  optionText: { fontSize: 16, color: Colors.text },
  optionTextSelected: { color: Colors.accent },
  check: { color: Colors.accent, fontSize: 16 },
});
```

Note: The `RecurrencePicker` doesn't show a `✓` checkmark for `'custom'` (the Custom › chevron serves that purpose visually).

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the files changed so far (some pre-existing errors from other files may appear — that's fine).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/RecurrencePicker.tsx
git commit -m "feat(mobile): add custom RecurrenceValue and CustomConfig to RecurrencePicker"
```

---

## Task 5: Install `@react-native-picker/picker` and create `CustomRecurrencePicker.tsx`

**Files:**
- Create: `mobile/src/components/CustomRecurrencePicker.tsx`

### Background

`@react-native-picker/picker` provides native iOS wheel spinners when rendered inline with a fixed height. On iOS, `Picker` renders as an inline scroll wheel when given an explicit height style (`height: 150`). The `itemStyle` prop controls the text appearance of each wheel item.

A new native build is required after installing this package. The implementer can use `mobile/scripts/sim.sh` to rebuild and test on the simulator.

- [ ] **Step 1: Install the package**

```bash
cd mobile && npx expo install @react-native-picker/picker
```

Expected: package added to `package.json` and `package-lock.json`.

- [ ] **Step 2: Create `mobile/src/components/CustomRecurrencePicker.tsx`**

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Colors, Fonts, Spacing } from '../theme';
import type { CustomConfig } from './RecurrencePicker';

export function customRecurrenceExtensions(c: CustomConfig): string {
  const freqMap: Record<CustomConfig['unit'], string> = {
    day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
  };
  const parts: string[] = [`frequency:${freqMap[c.unit]}`];
  if (c.n > 1) parts.push(`every:${c.n}`);
  if (c.unit === 'month') {
    if (c.monthDayType === 'date' && c.monthDate) {
      parts.push(`frequency-month-day:${c.monthDate === 32 ? 'last-day' : c.monthDate}`);
    } else if (c.monthDayType === 'positional' && c.positionOrdinal && c.positionWeekday) {
      parts.push(`frequency-month-day:${c.positionOrdinal}-${c.positionWeekday}`);
    }
  }
  return parts.join(' ');
}

const MAX_N: Record<CustomConfig['unit'], number> = { day: 60, week: 52, month: 24, year: 10 };

const ORD_LABELS: Record<NonNullable<CustomConfig['positionOrdinal']>, string> = {
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'Last',
};

const DAY_LABELS: Record<NonNullable<CustomConfig['positionWeekday']>, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

type Props = {
  config: CustomConfig;
  onChange: (c: CustomConfig) => void;
  onBack: () => void;
};

export function CustomRecurrencePicker({ config, onChange, onBack }: Props) {
  const [showOnDays, setShowOnDays] = useState(false);
  const [showOnWeek, setShowOnWeek] = useState(false);

  const maxN = MAX_N[config.unit];
  const nItems = Array.from({ length: maxN }, (_, i) => i + 1);

  function onUnitChange(unit: CustomConfig['unit']) {
    onChange({
      n: Math.min(config.n, MAX_N[unit]),
      unit,
      monthDayType: undefined,
      monthDate: undefined,
      positionOrdinal: undefined,
      positionWeekday: undefined,
    });
    setShowOnDays(false);
    setShowOnWeek(false);
  }

  function toggleOnDays() {
    if (!showOnDays) setShowOnWeek(false);
    setShowOnDays(v => !v);
  }

  function toggleOnWeek() {
    if (!showOnWeek) setShowOnDays(false);
    setShowOnWeek(v => !v);
  }

  const onDaysValue =
    config.monthDayType === 'date' && config.monthDate
      ? config.monthDate === 32 ? 'Last' : String(config.monthDate)
      : '—';

  const onWeekValue =
    config.monthDayType === 'positional' && config.positionOrdinal && config.positionWeekday
      ? `${ORD_LABELS[config.positionOrdinal]} ${DAY_LABELS[config.positionWeekday]}`
      : '—';

  return (
    <View style={styles.container}>
      {/* ‹ Back to presets */}
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>‹ Presets</Text>
      </TouchableOpacity>

      {/* Drum rolls: every [N] [unit] */}
      <View style={styles.drumRow}>
        <Text style={styles.everyLabel}>every</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={String(config.n)}
            onValueChange={v => onChange({ ...config, n: parseInt(v as string) })}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {nItems.map(n => (
              <Picker.Item key={n} label={String(n)} value={String(n)} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={config.unit}
            onValueChange={v => onUnitChange(v as CustomConfig['unit'])}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="day" value="day" />
            <Picker.Item label="week" value="week" />
            <Picker.Item label="month" value="month" />
            <Picker.Item label="year" value="year" />
          </Picker>
        </View>
      </View>

      {/* On Days and On Week — only when unit = month */}
      {config.unit === 'month' && (
        <>
          <TouchableOpacity style={styles.subRow} onPress={toggleOnDays}>
            <Text style={styles.subLabel}>On Days</Text>
            <View style={styles.subRight}>
              <Text style={[styles.subValue, config.monthDayType === 'date' && styles.subValueActive]}>
                {onDaysValue}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>

          {showOnDays && (
            <View style={styles.dayGrid}>
              {([...Array.from({ length: 31 }, (_, i) => i + 1), 32] as number[]).map(d => {
                const isSelected = config.monthDayType === 'date' && config.monthDate === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => {
                      onChange({
                        ...config,
                        monthDayType: 'date',
                        monthDate: d,
                        positionOrdinal: undefined,
                        positionWeekday: undefined,
                      });
                      setShowOnDays(false);
                    }}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                      {d === 32 ? 'Last' : String(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.subRow, !showOnWeek && styles.subRowLast]}
            onPress={toggleOnWeek}
          >
            <Text style={styles.subLabel}>On Week</Text>
            <View style={styles.subRight}>
              <Text style={[styles.subValue, config.monthDayType === 'positional' && styles.subValueActive]}>
                {onWeekValue}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>

          {showOnWeek && (
            <View style={[styles.drumRow, styles.drumRowLast]}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.positionOrdinal ?? 'first'}
                  onValueChange={v =>
                    onChange({
                      ...config,
                      monthDayType: 'positional',
                      positionOrdinal: v as CustomConfig['positionOrdinal'],
                      monthDate: undefined,
                    })
                  }
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="first" value="first" />
                  <Picker.Item label="second" value="second" />
                  <Picker.Item label="third" value="third" />
                  <Picker.Item label="fourth" value="fourth" />
                  <Picker.Item label="last" value="last" />
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.positionWeekday ?? 'monday'}
                  onValueChange={v =>
                    onChange({
                      ...config,
                      monthDayType: 'positional',
                      positionWeekday: v as CustomConfig['positionWeekday'],
                      monthDate: undefined,
                    })
                  }
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Sunday" value="sunday" />
                  <Picker.Item label="Monday" value="monday" />
                  <Picker.Item label="Tuesday" value="tuesday" />
                  <Picker.Item label="Wednesday" value="wednesday" />
                  <Picker.Item label="Thursday" value="thursday" />
                  <Picker.Item label="Friday" value="friday" />
                  <Picker.Item label="Saturday" value="saturday" />
                </Picker>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  backRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  backText: {
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  drumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 150,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  drumRowLast: {
    borderBottomWidth: 0,
  },
  everyLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    width: 40,
    letterSpacing: 0.5,
  },
  pickerWrap: {
    flex: 1,
    height: 150,
  },
  picker: {
    flex: 1,
    color: Colors.text,
  },
  pickerItem: {
    fontSize: 16,
    color: Colors.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  subRowLast: {
    borderBottomWidth: 0,
  },
  subLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  subRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subValue: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subValueActive: {
    color: Colors.accent,
  },
  chevron: {
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  dayChip: {
    width: 38,
    height: 34,
    borderWidth: 1,
    borderColor: Colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '11',
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  dayChipTextActive: {
    color: Colors.accent,
  },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit 2>&1 | grep CustomRecurrencePicker
```

Expected: no errors for `CustomRecurrencePicker.tsx`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/CustomRecurrencePicker.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): add CustomRecurrencePicker with drum-roll, On Days, On Week"
```

---

## Task 6: Wire `CustomRecurrencePicker` into `AddTaskModal.tsx`

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

### Background

Current imports from `./RecurrencePicker`:
```typescript
import { RecurrencePicker, recurrenceExtensions, recurrenceLabel } from './RecurrencePicker';
import type { RecurrenceValue } from './RecurrencePicker';
```

We need to add `CustomConfig` to that import and bring in `CustomRecurrencePicker` and `customRecurrenceExtensions` from the new file.

- [ ] **Step 1: Update imports at the top of `AddTaskModal.tsx`**

Replace:
```typescript
import { RecurrencePicker, recurrenceExtensions, recurrenceLabel } from './RecurrencePicker';
import type { RecurrenceValue } from './RecurrencePicker';
```
With:
```typescript
import { RecurrencePicker, recurrenceExtensions, recurrenceLabel } from './RecurrencePicker';
import type { RecurrenceValue, CustomConfig } from './RecurrencePicker';
import { CustomRecurrencePicker, customRecurrenceExtensions } from './CustomRecurrencePicker';
```

- [ ] **Step 2: Add `customConfig` state after the existing `const [showMore, setShowMore]` line**

```typescript
const [customConfig, setCustomConfig] = useState<CustomConfig>({ n: 1, unit: 'month' });
```

- [ ] **Step 3: Reset `customConfig` in `reset()`**

Add after `setShowRepeat(false);`:
```typescript
setCustomConfig({ n: 1, unit: 'month' });
```

- [ ] **Step 4: Update `handleAdd` to route 'custom' repeat**

Find the block inside `handleAdd` where `freqExt` is set (currently `const freqExt = recurrenceExtensions(repeat);`). Replace it with:

```typescript
const freqExt = repeat === 'custom'
  ? customRecurrenceExtensions(customConfig)
  : recurrenceExtensions(repeat);
```

The `if (freqExt) parts.push(freqExt);` line below it stays unchanged.

- [ ] **Step 5: Update the Repeat row value label**

Find:
```typescript
<Text style={repeat === 'none' ? styles.fnone : styles.fval}>
  {recurrenceLabel(repeat)}
</Text>
```

Replace with:
```typescript
<Text style={repeat === 'none' ? styles.fnone : styles.fval}>
  {recurrenceLabel(repeat, repeat === 'custom' ? customConfig : undefined)}
</Text>
```

- [ ] **Step 6: Replace the repeat picker render block**

Find:
```typescript
{showRepeat && (
  <RecurrencePicker
    value={repeat}
    onChange={r => {
      setRepeat(r);
      setShowRepeat(false);
    }}
  />
)}
```

Replace with:
```typescript
{showRepeat && (
  repeat === 'custom' ? (
    <CustomRecurrencePicker
      config={customConfig}
      onChange={setCustomConfig}
      onBack={() => setRepeat('none')}
    />
  ) : (
    <RecurrencePicker
      value={repeat}
      onChange={r => {
        setRepeat(r);
        if (r !== 'custom') setShowRepeat(false);
      }}
    />
  )
)}
```

When the user taps "Custom ›" in `RecurrencePicker`, `onChange('custom')` is called. `setRepeat('custom')` runs and `setShowRepeat(false)` is NOT called (because `r === 'custom'`), so the picker stays open and `CustomRecurrencePicker` renders. The `onBack` handler resets to `'none'` and re-shows the preset list.

- [ ] **Step 7: Run shared tests to confirm nothing broke**

```bash
bun test
```

Expected: all shared and console tests pass.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): wire CustomRecurrencePicker into AddTaskModal"
```

---

## Task 7: Build, smoke-test, and final commit

**Files:** none — verification and documentation only.

- [ ] **Step 1: Build and run on simulator**

```bash
mobile/scripts/sim.sh
```

A new native build is required because `@react-native-picker/picker` is a native module. This will take a few minutes the first time.

- [ ] **Step 2: Verify basic repeat presets still work**

Open the add task modal. Tap SHOW MORE → enable Start date. Tap the Repeat row. Confirm Never / Every Day / Every Week / Every 2 Weeks / Every Month / Every Year / Custom › all appear. Select "Every Week", confirm row shows "Every Week" in accent and picker closes.

- [ ] **Step 3: Verify Custom — N and unit wheels**

Tap Repeat → Custom ›. Confirm:
- `CustomRecurrencePicker` appears (preset list gone)
- "‹ Presets" link at top
- Two wheel spinners: N (defaulting to 1) and unit (defaulting to month)
- "On Days" and "On Week" rows visible below wheels
- Repeat row label shows "Every 1 Mo"

Spin N to 3. Confirm label updates to "Every 3 Mos". Spin unit to "week". Confirm On Days / On Week rows disappear. Label shows "Every 3 Wks". Tap Add with title "quarterly review". Confirm task is saved with `frequency:weekly every:3`.

- [ ] **Step 4: Verify On Days**

Tap Repeat → Custom ›. Keep unit=month. Tap "On Days". Confirm grid 1–31 + Last appears. Tap 15. Confirm grid collapses, On Days row shows "15" in accent, label shows "Monthly · 15th". Add task. Confirm raw has `frequency:monthly frequency-month-day:15`.

- [ ] **Step 5: Verify On Week**

Tap Repeat → Custom ›. Keep unit=month. Tap "On Week". Confirm two wheel pickers appear (ordinal + weekday). Spin to "first" + "Monday". Confirm On Week row shows "1st Mon" in accent, label shows "Monthly · 1st Mon". Tap "‹ Presets". Confirm preset list returns. Tap Custom › again — confirm customConfig was preserved (label still shows "Monthly · 1st Mon" for the On Week selection).

- [ ] **Step 6: Verify ‹ Presets back-navigation**

While in Custom picker, tap "‹ Presets". Confirm preset list reappears with "Never" (because `onBack` sets repeat to 'none'). Select "Every Month". Confirm Repeat row shows "Every Month" and preset list closes.

- [ ] **Step 7: Run all tests one more time**

```bash
bun test
```

Expected: all pass.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(mobile): Custom repeat — drum-roll every N interval with On Days and On Week"
```
