# Add Weekday Multi-Select to Custom Weekly Recurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix GitHub issue #58 — the mobile Add Task custom recurrence picker has no way to pick which weekdays (M/T/W/Th/F) a weekly-recurring task repeats on. After selecting "week" as the unit, the screen jumps straight to Priority with nothing to configure. This isn't a scroll bug — it's a missing control. The underlying data model and shared scheduling logic (`frequency-day:M,T,W,Th,F` extension + `nextWeeklyDate(startStr, todayStr, every, exdates, frequencyDay)` in `shared/commands/focus.ts`) already fully support this; only the mobile UI to produce that extension is missing.

**Architecture:** Mirrors the existing month "On Days" chip-grid pattern in `CustomRecurrencePicker.tsx`, but as a **multi-select** (toggle on/off) instead of single-select, since a weekly recurrence can span multiple weekdays at once. Three pieces, each building on the last:
1. `CustomConfig` (`RecurrencePicker.tsx`) gains a `weekDays?: WeekDayCode[]` field, always stored pre-sorted in canonical `Sun,M,T,W,Th,F,Sat` order (sorted at the point of toggling) so downstream consumers (`customRecurrenceExtensions`, `recurrenceLabel`) can `.join(',')` directly without re-sorting.
2. `customRecurrenceExtensions()` (`CustomRecurrencePicker.tsx`) appends `frequency-day:<joined codes>` when `unit === 'week'` and at least one day is selected. `recurrenceLabel()` (`RecurrencePicker.tsx`) shows the selected days in the "Repeat" row summary (e.g. `Weekly · M,W,F`).
3. `CustomRecurrencePicker.tsx` renders a 7-chip weekday grid (Sun–Sat) when `config.unit === 'week'`, reusing the existing `dayGrid`/`dayChip` styles.

No shared-layer or parser changes are needed — `frequency-day:` is already a supported extension end-to-end (parsing, `nextWeeklyDate`, focus window, sort key, all documented in the repo `CLAUDE.md`).

**Tech Stack:** TypeScript, React Native, Jest (mobile tests).

## Global Constraints

- `verbatimModuleSyntax: true` — use `import type` for all type-only imports.
- Do not touch `shared/` or `console/` — this is purely a mobile UI gap; the extension format it produces is already fully supported end-to-end.
- Preserve the existing permissive pattern used for month recurrence: if the user picks "week" but selects zero weekday chips, `customRecurrenceExtensions` must NOT block or error — it simply omits `frequency-day`, falling back to plain `frequency:weekly [every:N]` (recur on the same weekday as `start:`), exactly like the "Every Week"/"Every 2 Weeks" presets. Do not add validation that blocks Add when no day is selected.
- Run mobile tests with `cd mobile && npm test`. Run a single file with `cd mobile && npm test -- <path>`.
- Mobile component files (`.tsx`) in this repo have no rendering-test infrastructure (no `@testing-library/react-native`) — but the pure functions (`customRecurrenceExtensions`, `recurrenceLabel`) exported from these files ARE plain TS and must be unit tested directly, same pattern as other pure logic in the mobile layer.

---

### Task 1: Add `weekDays` field to `CustomConfig` and wire it into `recurrenceLabel()`

**Files:**
- Modify: `mobile/src/components/RecurrencePicker.tsx`
- Test: `mobile/src/__tests__/recurrencePicker.test.ts` (new file)

**Interfaces:**
- Produces: `export type WeekDayCode = 'Sun' | 'M' | 'T' | 'W' | 'Th' | 'F' | 'Sat';` and `CustomConfig.weekDays?: WeekDayCode[]`, exported from `RecurrencePicker.tsx`.
- Produces: `recurrenceLabel(value, custom)` returns `Weekly · <joined codes>` (e.g. `Weekly · M,W,F`) when `custom.unit === 'week'` and `custom.weekDays` is non-empty; unchanged behavior otherwise (falls through to the existing generic `Every N Wk(s)` label when no days are selected).

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/recurrencePicker.test.ts`:

```ts
import { recurrenceLabel } from '../components/RecurrencePicker';

describe('recurrenceLabel', () => {
  test('shows selected weekdays for a custom weekly recurrence', () => {
    const label = recurrenceLabel('custom', { n: 1, unit: 'week', weekDays: ['M', 'W', 'F'] });
    expect(label).toBe('Weekly · M,W,F');
  });

  test('falls back to generic "Every N Wk(s)" label when no weekdays are selected', () => {
    expect(recurrenceLabel('custom', { n: 1, unit: 'week' })).toBe('Every 1 Wk');
    expect(recurrenceLabel('custom', { n: 2, unit: 'week' })).toBe('Every 2 Wks');
  });

  test('ignores an empty weekDays array the same as undefined', () => {
    expect(recurrenceLabel('custom', { n: 1, unit: 'week', weekDays: [] })).toBe('Every 1 Wk');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npm test -- recurrencePicker`
Expected: FAIL — `weekDays` doesn't exist on `CustomConfig` yet (type error) and the weekday-summary branch doesn't exist in `recurrenceLabel`.

- [ ] **Step 3: Write minimal implementation**

In `mobile/src/components/RecurrencePicker.tsx`, add the type after the existing `CustomConfig` type fields (currently after `positionWeekday` on line 19):

```ts
export type WeekDayCode = 'Sun' | 'M' | 'T' | 'W' | 'Th' | 'F' | 'Sat';

export type CustomConfig = {
  n: number;
  unit: 'day' | 'week' | 'month' | 'year';
  monthDayType?: 'date' | 'positional';
  monthDate?: number; // 1–31; 32 = Last → frequency-month-day:last-day
  positionOrdinal?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  positionWeekday?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  weekDays?: WeekDayCode[]; // always pre-sorted Sun..Sat by the picker's toggle handler
};
```

Then in `recurrenceLabel`, add a `unit === 'week'` branch right before the existing `if (custom.unit === 'month') {` block:

```ts
    if (custom.unit === 'week' && custom.weekDays && custom.weekDays.length > 0) {
      return `Weekly · ${custom.weekDays.join(',')}`;
    }
    if (custom.unit === 'month') {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npm test -- recurrencePicker`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/RecurrencePicker.tsx mobile/src/__tests__/recurrencePicker.test.ts
git commit -m "feat(mobile): add weekDays field to CustomConfig and wire into recurrenceLabel"
```

---

### Task 2: Emit `frequency-day:` from `customRecurrenceExtensions()` for weekly recurrence

**Files:**
- Modify: `mobile/src/components/CustomRecurrencePicker.tsx`
- Test: `mobile/src/__tests__/recurrencePicker.test.ts`

**Interfaces:**
- Consumes: `CustomConfig.weekDays` (Task 1).
- Produces: `customRecurrenceExtensions(c)` includes `frequency-day:<joined codes>` in its output when `c.unit === 'week'` and `c.weekDays` is non-empty. No signature change.

- [ ] **Step 1: Write the failing test**

Add to `mobile/src/__tests__/recurrencePicker.test.ts` (new import + new describe block):

Change the top import from:
```ts
import { recurrenceLabel } from '../components/RecurrencePicker';
```
to:
```ts
import { recurrenceLabel } from '../components/RecurrencePicker';
import { customRecurrenceExtensions } from '../components/CustomRecurrencePicker';
```

Append:

```ts
describe('customRecurrenceExtensions — weekly with selected days', () => {
  test('appends frequency-day for selected weekdays', () => {
    const ext = customRecurrenceExtensions({ n: 1, unit: 'week', weekDays: ['M', 'T', 'W', 'Th', 'F'] });
    expect(ext).toBe('frequency:weekly frequency-day:M,T,W,Th,F');
  });

  test('omits frequency-day when no weekdays are selected (plain weekly, same weekday as start)', () => {
    const ext = customRecurrenceExtensions({ n: 1, unit: 'week' });
    expect(ext).toBe('frequency:weekly');
  });

  test('combines every:N with frequency-day, joining weekDays in the order given', () => {
    const ext = customRecurrenceExtensions({ n: 2, unit: 'week', weekDays: ['Sun', 'Sat'] });
    expect(ext).toBe('frequency:weekly every:2 frequency-day:Sun,Sat');
  });
});
```

`customRecurrenceExtensions` does NOT sort `weekDays` — it trusts the array is already in the order the caller wants joined. The third test passes already-sorted input (`['Sun', 'Sat']`) for that reason. Canonical `Sun..Sat` ordering is enforced upstream, by the picker's toggle handler in Task 3 — do not add sorting logic here; that would duplicate Task 3's responsibility.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npm test -- recurrencePicker`
Expected: FAIL — `customRecurrenceExtensions` doesn't yet emit `frequency-day` for `unit === 'week'`.

- [ ] **Step 3: Write minimal implementation**

In `mobile/src/components/CustomRecurrencePicker.tsx`, update `customRecurrenceExtensions` (currently lines 7-21):

```ts
export function customRecurrenceExtensions(c: CustomConfig): string {
  const freqMap: Record<CustomConfig['unit'], string> = {
    day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
  };
  const parts: string[] = [`frequency:${freqMap[c.unit]}`];
  if (c.n > 1) parts.push(`every:${c.n}`);
  if (c.unit === 'month') {
    if (c.monthDayType === 'date' && c.monthDate != null) {
      parts.push(`frequency-month-day:${c.monthDate === 32 ? 'last-day' : c.monthDate}`);
    } else if (c.monthDayType === 'positional' && c.positionOrdinal && c.positionWeekday) {
      parts.push(`frequency-month-day:${c.positionOrdinal}-${c.positionWeekday}`);
    }
  } else if (c.unit === 'week' && c.weekDays && c.weekDays.length > 0) {
    parts.push(`frequency-day:${c.weekDays.join(',')}`);
  }
  return parts.join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npm test -- recurrencePicker`
Expected: PASS (all tests so far)

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/CustomRecurrencePicker.tsx mobile/src/__tests__/recurrencePicker.test.ts
git commit -m "feat(mobile): emit frequency-day extension for custom weekly recurrence"
```

---

### Task 3: Add the weekday multi-select chip UI

**Files:**
- Modify: `mobile/src/components/CustomRecurrencePicker.tsx`

**Interfaces:**
- Consumes: `CustomConfig.weekDays`, `onChange: (c: CustomConfig) => void` (existing prop).
- No test file — this is the interactive chip grid itself (component rendering, no test infra per Global Constraints). Verify manually per Task 4.

- [ ] **Step 1: Add the canonical weekday list and a toggle helper**

In `mobile/src/components/CustomRecurrencePicker.tsx`, add after the existing `DAY_LABELS` constant (currently lines 29-32):

```ts
const WEEKDAYS: { code: NonNullable<CustomConfig['weekDays']>[number]; label: string }[] = [
  { code: 'Sun', label: 'Sun' },
  { code: 'M', label: 'Mon' },
  { code: 'T', label: 'Tue' },
  { code: 'W', label: 'Wed' },
  { code: 'Th', label: 'Thu' },
  { code: 'F', label: 'Fri' },
  { code: 'Sat', label: 'Sat' },
];
```

Inside the `CustomRecurrencePicker` component function (after the existing `toggleOnWeek` function, currently lines 66-69), add:

```ts
  function toggleWeekDay(code: (typeof WEEKDAYS)[number]['code']) {
    const current = config.weekDays ?? [];
    const next = current.includes(code)
      ? current.filter(d => d !== code)
      : WEEKDAYS.map(w => w.code).filter(c => current.includes(c) || c === code);
    onChange({ ...config, weekDays: next });
  }
```

(`next` is always rebuilt by filtering the canonical `WEEKDAYS` order rather than appending, so `config.weekDays` stays pre-sorted `Sun..Sat` regardless of click order — this is what lets `customRecurrenceExtensions`/`recurrenceLabel` join it directly without re-sorting, per Task 1/2.)

- [ ] **Step 2: Reset `weekDays` on unit change**

In `onUnitChange` (currently lines 47-58), add `weekDays: undefined` to the reset object so switching away from (or into) "week" clears any stale selection:

```ts
  function onUnitChange(unit: CustomConfig['unit']) {
    onChange({
      n: Math.min(config.n, MAX_N[unit]),
      unit,
      monthDayType: undefined,
      monthDate: undefined,
      positionOrdinal: undefined,
      positionWeekday: undefined,
      weekDays: undefined,
    });
    setShowOnDays(false);
    setShowOnWeek(false);
  }
```

- [ ] **Step 3: Render the chip grid when `unit === 'week'`**

In the JSX, add a new block as a sibling of the existing `{config.unit === 'month' && (...)}` block (currently lines 119-221), right after it and before the closing `</View>` of `container`:

```tsx
      {config.unit === 'week' && (
        <>
          <View style={styles.subRow}>
            <Text style={styles.subLabel}>Repeat On</Text>
          </View>
          <View style={[styles.dayGrid, styles.dayGridLast]}>
            {WEEKDAYS.map(({ code, label }) => {
              const isSelected = (config.weekDays ?? []).includes(code);
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.dayChip, isSelected && styles.dayChipActive]}
                  onPress={() => toggleWeekDay(code)}
                >
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
```

- [ ] **Step 4: Add the `dayGridLast` style**

In the `styles` `StyleSheet.create` block, add next to the existing `dayGrid` style (currently lines 305-313):

```ts
  dayGridLast: {
    borderBottomWidth: 0,
  },
```

- [ ] **Step 5: Type-check the mobile project**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new type errors introduced by this file (2 pre-existing unrelated errors in `store.test.ts`/`task-lifecycle.test.ts` are expected and not caused by this change).

- [ ] **Step 6: Run the mobile test suite**

Run: `cd mobile && npm test`
Expected: PASS — same pre-existing 2 failing suites (unrelated Flow-syntax import issue), all other tests including the new `recurrencePicker.test.ts` pass.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/components/CustomRecurrencePicker.tsx
git commit -m "feat(mobile): add weekday multi-select chip grid to custom weekly recurrence

Fixes #58"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full mobile test suite**

Run: `cd mobile && npm test`
Expected: same pre-existing 2 failing suites only; all other suites pass, including `recurrencePicker.test.ts`.

- [ ] **Step 2: Type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: same 2 pre-existing errors only.

- [ ] **Step 3: Manually verify the exact repro case from issue #58**

If a simulator/device build is available (`mobile/scripts/sim.sh`): open Add Task → toggle "Repeat" → Custom → set unit to "week" → confirm a "Repeat On" row with Sun–Sat chips now appears (not jumping straight to Priority) → select M, T, W, Th, F → confirm the "Repeat" summary row shows `Weekly · M,T,W,Th,F` → Add the task → confirm the created todo.txt line contains `frequency:weekly frequency-day:M,T,W,Th,F`.

- [ ] **Step 4: Confirm zero-selection fallback still works**

In the same flow, set unit to "week" but select no chips → confirm Add still succeeds and produces `frequency:weekly` with no `frequency-day` (recurs on the same weekday as `start:`), matching the existing "Every Week" preset behavior — no validation error should block this.
