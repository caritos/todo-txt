# Event End Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user record what time an event ends (e.g. "team standup 9:00–9:30"), for both recurring and non-recurring events. GitHub issue #75.

**Architecture:** A new `end-time:HH:MM` todo.txt extension, decoupled from the existing date-only `end:` (multi-day span). No shared-layer (`shared/`) changes — every consumer reads `task.extensions['end-time']` directly since it's occurrence-date-independent. Two pure Date helpers are added to `mobile/src/uiUtils.ts` for the Add/Edit UI's default-value and clamping logic.

**Tech Stack:** TypeScript, React Native / Expo Router (mobile), Bun test (shared/console), Jest (mobile).

## Global Constraints

- New extension key is exactly `end-time:HH:MM` (24-hour, zero-padded) — never overload `end:` with a time component.
- Event-only (`type:event`). Never appears on plain tasks.
- Only meaningful/settable when the event has a start *time* (`start:` includes a `T` component). No UI for it otherwise.
- Independent of the "End date" (multi-day) toggle — can be set with or without a differing `end:` date.
- Works identically for recurring and non-recurring events (no `frequency:` gating).
- Auto-snap validation, no error state: an end time earlier than the start time (same calendar day) snaps forward to equal the start time. No overnight-spanning support.
- Design source of truth: `docs/superpowers/specs/2026-07-17-event-end-time-design.md`.

---

## Task 1: Time-of-day helpers in `uiUtils.ts`

**Files:**
- Modify: `mobile/src/uiUtils.ts`
- Test: `mobile/src/__tests__/uiUtils.test.ts`

**Interfaces:**
- Produces: `timeMinutes(d: Date): number` — minutes since midnight, local time. `defaultEndTime(start: Date): Date` — `start` plus 60 minutes, clamped to no later than 23:59 the same calendar day (never rolls into the next day).

- [ ] **Step 1: Write the failing tests**

Append to `mobile/src/__tests__/uiUtils.test.ts` (after the existing `parseDateParts` describe block, matching its style):

```ts
import { pad, buildCells, cleanTitle, hourLabel, formatTime, parseDateParts, timeMinutes, defaultEndTime } from '../uiUtils';
```

Replace the existing import line (line 2) with the one above, then append:

```ts
// ─── timeMinutes ───────────────────────────────────────────────────────────
describe('timeMinutes', () => {
  test('midnight is 0', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 0, 0))).toBe(0);
  });

  test('9:30 AM is 570', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 9, 30))).toBe(570);
  });

  test('11:59 PM is 1439', () => {
    expect(timeMinutes(new Date(2026, 0, 1, 23, 59))).toBe(1439);
  });

  test('ignores date components, only reads hours/minutes', () => {
    expect(timeMinutes(new Date(2020, 5, 15, 14, 0))).toBe(timeMinutes(new Date(2030, 0, 1, 14, 0)));
  });
});

// ─── defaultEndTime ────────────────────────────────────────────────────────
describe('defaultEndTime', () => {
  test('adds 60 minutes to a mid-day start', () => {
    const start = new Date(2026, 0, 1, 9, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(0);
  });

  test('preserves the calendar date of start', () => {
    const start = new Date(2026, 6, 15, 9, 0);
    const end = defaultEndTime(start);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(15);
  });

  test('clamps to 23:59 instead of rolling into the next day', () => {
    const start = new Date(2026, 0, 1, 23, 30);
    const end = defaultEndTime(start);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  test('23:00 plus 60 minutes clamps to 23:59, not 24:00', () => {
    const start = new Date(2026, 0, 1, 23, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  test('22:00 plus 60 minutes is exactly 23:00 (no clamping needed)', () => {
    const start = new Date(2026, 0, 1, 22, 0);
    const end = defaultEndTime(start);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile && npm test -- uiUtils` (if `node_modules` is missing, run `npm install` first)
Expected: FAIL — `timeMinutes` and `defaultEndTime` are not exported from `../uiUtils`.

- [ ] **Step 3: Implement the helpers**

Append to `mobile/src/uiUtils.ts` (after the existing `parseDateParts` function):

```ts
export function timeMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function defaultEndTime(start: Date): Date {
  const mins = Math.min(timeMinutes(start) + 60, 23 * 60 + 59);
  const d = new Date(start);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile && npm test -- uiUtils`
Expected: PASS, all `timeMinutes`/`defaultEndTime` cases green, no regressions in the existing `pad`/`buildCells`/`cleanTitle`/`hourLabel`/`formatTime`/`parseDateParts` cases.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/uiUtils.ts mobile/src/__tests__/uiUtils.test.ts
git commit -m "feat(mobile): add timeMinutes/defaultEndTime helpers for event end time"
```

---

## Task 2: Console + README — display and document `end-time:`

**Files:**
- Modify: `console/output.ts`
- Test: `console/tests/commands/focus.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: `formatFocusTask` (unchanged signature) now appends an end-time suffix to its `when` string when `task.extensions['end-time']` is set.

- [ ] **Step 1: Write the failing tests**

Add to `console/tests/commands/focus.test.ts`, in the "Non-recurring events" section (after the existing `Dentist` test at line ~59):

```ts
test('shows end time range when end-time: is set alongside a start: time', () => {
  const start = addDays(today, 5);
  writeFileSync(todoFile, `2026-05-06 Standup start:${start}T09:00 end-time:09:30 type:event\n`, 'utf8');
  const { stdout } = run(['--file', todoFile, 'focus']);
  expect(stdout).toContain('09:00-09:30');
});

test('shows only start time when end-time: is not set', () => {
  const start = addDays(today, 5);
  writeFileSync(todoFile, `2026-05-06 Dentist start:${start}T09:00 type:event\n`, 'utf8');
  const { stdout } = run(['--file', todoFile, 'focus']);
  expect(stdout).toContain('09:00');
  expect(stdout).not.toContain('09:00-');
});

test('does not crash when end-time: is set but start: has no time component', () => {
  const start = addDays(today, 5);
  writeFileSync(todoFile, `2026-05-06 All-day thing start:${start} end-time:09:30 type:event\n`, 'utf8');
  const { stdout, code } = run(['--file', todoFile, 'focus']);
  expect(code).toBe(0);
  expect(stdout).toContain('All-day thing');
  expect(stdout).not.toContain('09:30');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test console/tests/commands/focus.test.ts`
Expected: FAIL — first new test fails because stdout contains `09:00` but not `09:00-09:30` (no suffix logic exists yet).

- [ ] **Step 3: Implement the end-time suffix**

In `console/output.ts`, inside `formatFocusTask` (currently lines 73-112), the `when` string is built at lines 76-85:

```ts
  const datePart = effectiveDate.slice(0, 10);
  const timePart = effectiveDate.length > 10 ? effectiveDate.slice(11, 16) : '';
  let when: string;
  if (datePart === todayStr) {
    when = timePart ? `today ${timePart}` : 'today';
  } else {
    const d = new Date(datePart + 'T12:00:00');
    const dm = `${MON_ABBR[d.getMonth()]} ${d.getDate()}`;
    when = timePart ? `${DAY_ABBR[d.getDay()]} ${dm} ${timePart}` : `${DAY_ABBR[d.getDay()]} ${dm}`;
  }
```

Add immediately after that `if`/`else` block (before the `const cleanText = ...` line that currently follows):

```ts
  const endTimeExt = task.extensions['end-time'];
  if (endTimeExt && timePart) when += `-${endTimeExt}`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test console/tests/commands/focus.test.ts`
Expected: PASS, all 3 new cases plus every existing case in the file.

- [ ] **Step 5: Update README.md**

In the "Scheduling extensions" table (`README.md:84-98`), replace the `end:` row and add a new row directly after it:

```diff
 | `start:<date>` | Start date — `YYYY-MM-DD` or `YYYY-MM-DDThh:mm` | `start:2026-05-10T09:00` |
-| `end:<date>` | End date/time | `end:2026-05-10T09:30` |
+| `end:<date>` | End date — `YYYY-MM-DD`, for multi-day spans | `end:2026-05-12` |
+| `end-time:<time>` | End time of day — `HH:MM`, for events with a `start:` time | `end-time:09:30` |
 | `due:<date>` | Due date (shown in focus when approaching or overdue) | `due:2026-05-15` |
```

Add a new example line to the "Examples" section (`README.md:110-119`), after the existing `todo event "Standup start:2026-05-10T09:00 frequency:weekly frequency-day:M,W,F"` line:

```
todo event "Standup start:2026-05-10T09:00 end-time:09:30 frequency:weekly frequency-day:M,W,F"
```

- [ ] **Step 6: Commit**

```bash
git add console/output.ts console/tests/commands/focus.test.ts README.md
git commit -m "feat(console): display event end-time range in focus output; document end-time: extension"
```

---

## Task 3: Add screen — "End time" row in `AddTaskModal.tsx`

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

**Interfaces:**
- Consumes: `timeMinutes`, `defaultEndTime` from `../uiUtils` (Task 1).
- Produces: an event created via the Add screen now optionally carries `end-time:HH:MM` in its raw text.

- [ ] **Step 1: Add the import**

At the top of `mobile/src/components/AddTaskModal.tsx`, change:

```ts
import { today } from '../utils';
```

to:

```ts
import { today } from '../utils';
import { timeMinutes, defaultEndTime } from '../uiUtils';
```

- [ ] **Step 2: Add state**

After the existing `endDate` state (line 71: `const [endDate, setEndDate] = useState(() => new Date());`), add:

```ts
const [hasEndTime, setHasEndTime] = useState(false);
const [endTime, setEndTime] = useState(() => new Date());
```

- [ ] **Step 3: Reset new state on close**

In `reset()` (lines 82-97), after `setEndDate(new Date());` (line 91), add:

```ts
setHasEndTime(false);
setEndTime(new Date());
```

- [ ] **Step 4: Push `end-time:` in `handleAdd`**

In `handleAdd()`, the current `if (hasDate) { ... }` block (lines 117-131) ends with:

```ts
      if (addType === 'event' && hasEnd) {
        parts.push(`end:${dateToISO(endDate)}`);
      } else {
        const freqExt = repeat === 'custom'
          ? customRecurrenceExtensions(customConfig)
          : recurrenceExtensions(repeat);
        if (freqExt) parts.push(freqExt);
      }
    }
```

Insert a new block between the closing `}` of the `if/else` and the closing `}` of `if (hasDate)`:

```ts
      if (addType === 'event' && hasEnd) {
        parts.push(`end:${dateToISO(endDate)}`);
      } else {
        const freqExt = repeat === 'custom'
          ? customRecurrenceExtensions(customConfig)
          : recurrenceExtensions(repeat);
        if (freqExt) parts.push(freqExt);
      }
      if (addType === 'event' && hasTime && hasEndTime) {
        parts.push(`end-time:${pad(endTime.getHours())}:${pad(endTime.getMinutes())}`);
      }
    }
```

- [ ] **Step 5: Snap `endTime` forward when start time moves past it; add `onEndTimeChange`**

Replace the existing `onTimeChange` (lines 156-158):

```ts
function onTimeChange(_: DateTimePickerEvent, t?: Date) {
  if (t) setTime(t);
}
```

with:

```ts
function onTimeChange(_: DateTimePickerEvent, t?: Date) {
  if (!t) return;
  setTime(t);
  if (hasEndTime && timeMinutes(t) > timeMinutes(endTime)) setEndTime(t);
}

function onEndTimeChange(_: DateTimePickerEvent, t?: Date) {
  if (!t) return;
  setEndTime(timeMinutes(t) < timeMinutes(time) ? time : t);
}
```

(This adds `onEndTimeChange` right after `onTimeChange`, before the existing `onEndDateChange`.)

- [ ] **Step 6: Cascade-clear `hasEndTime` when start Time is turned off**

The Time row's `Switch` (lines 324-333) currently:

```tsx
                    <View style={[styles.frow, hasEnd && !hasTime && styles.frowLast]}>
                      <Text style={styles.flabel}>Time</Text>
                      <Switch
                        value={hasTime}
                        onValueChange={setHasTime}
                        trackColor={{ false: Colors.separator, true: Colors.accent }}
                        thumbColor={Colors.text}
                        ios_backgroundColor={Colors.separator}
                      />
                    </View>
```

Change `onValueChange={setHasTime}` to:

```tsx
                        onValueChange={v => {
                          setHasTime(v);
                          if (!v) setHasEndTime(false);
                        }}
```

The inline clear button inside the time picker block (lines 347-352):

```tsx
                          <TouchableOpacity
                            onPress={() => setHasTime(false)}
                            style={styles.timeClear}
                          >
```

Change `onPress={() => setHasTime(false)}` to:

```tsx
                            onPress={() => { setHasTime(false); setHasEndTime(false); }}
```

- [ ] **Step 7: Simplify the Time-picker wrapper's `frowLast` (dead condition)**

The Time picker row wrapper (line 336):

```tsx
                      <View style={[styles.frow, hasEnd && styles.frowLast]}>
```

`hasEnd` can only be `true` while `addType === 'event'`, and for events this row is about to always be followed by the new End-time toggle row (Step 8) — so it can never legitimately be the last row anymore. Simplify to:

```tsx
                      <View style={styles.frow}>
```

- [ ] **Step 8: Insert the new "End time" rows**

Immediately after the closing `)}` of the `{hasTime && ( ... )}` block (line 355) and before `{!hasEnd && ( <TouchableOpacity ... Repeat` (line 357), insert:

```tsx
                    {addType === 'event' && hasTime && (
                      <View style={[styles.frow, !hasEndTime && hasEnd && styles.frowLast]}>
                        <Text style={styles.flabel}>End time</Text>
                        <Switch
                          value={hasEndTime}
                          onValueChange={v => {
                            setHasEndTime(v);
                            if (v) setEndTime(defaultEndTime(time));
                          }}
                          trackColor={{ false: Colors.separator, true: Colors.accent }}
                          thumbColor={Colors.text}
                          ios_backgroundColor={Colors.separator}
                        />
                      </View>
                    )}

                    {addType === 'event' && hasTime && hasEndTime && (
                      <View style={[styles.frow, hasEnd && styles.frowLast]}>
                        <Text style={styles.flabel} />
                        <View style={styles.timeSet}>
                          <DateTimePicker
                            mode="time"
                            display="compact"
                            value={endTime}
                            onChange={onEndTimeChange}
                            accentColor={Colors.accent}
                            style={styles.compactPicker}
                          />
                          <TouchableOpacity
                            onPress={() => setHasEndTime(false)}
                            style={styles.timeClear}
                          >
                            <Text style={styles.timeClearText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
```

- [ ] **Step 9: Manual verification**

Run: `mobile/scripts/sim.sh`

In the running app:
1. Tap **+**, switch to **EVENT**, enter a title, tap **SHOW MORE**.
2. Turn on **Start date**, turn on **Time**, set it to `9:00 AM`. Confirm a new **End time** row appears below Time.
3. Turn on **End time** — confirm it defaults to `10:00 AM` (start + 1 hour).
4. Try dragging the end time picker to `8:30 AM` (before start) — confirm it snaps forward to `9:00 AM`, not left at `8:30 AM`.
5. Move the start time to `9:15 AM` — confirm the end time (currently `9:00 AM`, now before the new start) snaps forward to `9:15 AM`.
6. Turn off **Time** — confirm the **End time** row disappears and its switch resets.
7. Re-enable Time + End time, tap **+** to save. No crash.
8. Confirm no visible double borders or missing borders in the group (a quick visual check of the row separators around Time / End time / the group's bottom edge).

- [ ] **Step 10: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): add End time row to the Add Event screen"
```

---

## Task 4: Calendar agenda — display the end-time range

**Files:**
- Modify: `mobile/app/calendar.tsx`

**Interfaces:**
- Consumes: `task.extensions['end-time']` (raw string, set by Task 3 or hand-edited todo.txt).
- Produces: `AgendaItem.endTime?: string`, rendered as `"9:00 - 9:30"` in the agenda row.

- [ ] **Step 1: Add `endTime` to the `AgendaItem` type**

Current (lines 33-40):

```ts
type AgendaItem = {
  key: string;
  task: Task;
  kind: 'completed' | 'incomplete' | 'event';
  time?: string;
  isOverdue?: boolean;
  overdueDate?: string;
};
```

Add `endTime?: string;` after `time?: string;`:

```ts
type AgendaItem = {
  key: string;
  task: Task;
  kind: 'completed' | 'incomplete' | 'event';
  time?: string;
  endTime?: string;
  isOverdue?: boolean;
  overdueDate?: string;
};
```

- [ ] **Step 2: Populate `endTime` for event occurrences**

Current (lines 139-144):

```ts
        byDate.get(occ.date)!.push({
          key: `event-${t.line}-${occ.date}`,
          task: t,
          kind: 'event',
          time: t.extensions['start']?.slice(11, 16) || undefined,
        });
```

Change to:

```ts
        byDate.get(occ.date)!.push({
          key: `event-${t.line}-${occ.date}`,
          task: t,
          kind: 'event',
          time: t.extensions['start']?.slice(11, 16) || undefined,
          endTime: t.extensions['end-time'] || undefined,
        });
```

(The other two `byDate.get(...).push(...)` call sites — completed tasks at line ~102-107 and incomplete tasks at line ~123-130 — are left unchanged. The incomplete-task loop already excludes typed/event tasks via its `!!item.task.extensions['type']` guard at line 114, so events only ever flow through this one call site.)

- [ ] **Step 3: Render the range**

Current (lines 349-353):

```tsx
              {item.overdueDate ? (
                <Text style={styles.agendaOverdue}>{overdueSinceLabel(item.overdueDate)}</Text>
              ) : item.time ? (
                <Text style={styles.agendaTime}>{item.time}</Text>
              ) : null}
```

Change to:

```tsx
              {item.overdueDate ? (
                <Text style={styles.agendaOverdue}>{overdueSinceLabel(item.overdueDate)}</Text>
              ) : item.time ? (
                <Text style={styles.agendaTime}>{item.time}{item.endTime ? ` - ${item.endTime}` : ''}</Text>
              ) : null}
```

- [ ] **Step 4: Manual verification**

Run: `mobile/scripts/sim.sh` (reuse the running instance from Task 3 if still open)

1. Using the event created in Task 3's verification (with a start and end time), open Calendar and scroll to its date.
2. Confirm the agenda row shows `9:00 - 9:15` (or whatever times were set) instead of just `9:00`.
3. Find (or create via `t event` in the console, or hand-edit `todo.txt`) an event with a start time but no `end-time:` — confirm its row still shows just the single time, unchanged from before this task.
4. Confirm an overdue item (if any visible) still shows its `due <date>` label instead of a time — i.e. the `item.overdueDate` branch still takes priority, unaffected by this change.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/calendar.tsx
git commit -m "feat(mobile): show event end-time range in the Calendar agenda"
```

---

## Task 5: Task Detail — "End time" row in `task/[line].tsx`

**Files:**
- Modify: `mobile/app/task/[line].tsx`

**Interfaces:**
- Consumes: `timeMinutes`, `defaultEndTime` from `../../src/uiUtils` (Task 1).
- Produces: editing an existing event's end time immediately persists `end-time:HH:MM` (or removes it) via `applyEdit`.

- [ ] **Step 1: Add the import**

Current (line 14):

```ts
import { today, formatDateLabel } from '../../src/utils';
```

Add a new import line directly after it:

```ts
import { today, formatDateLabel } from '../../src/utils';
import { timeMinutes, defaultEndTime } from '../../src/uiUtils';
```

- [ ] **Step 2: Add state, synced from the task**

Current (lines 30-34):

```ts
  const [hasEnd, setHasEnd] = useState(!!task?.extensions['end']);
  const [endDate, setEndDate] = useState(() => {
    const end = task?.extensions['end'];
    return end ? new Date(end.slice(0, 10) + 'T12:00:00') : new Date();
  });
```

Add after it:

```ts
  const [hasEndTime, setHasEndTime] = useState(!!task?.extensions['end-time']);
  const [endTimeVal, setEndTimeVal] = useState(() => {
    const et = task?.extensions['end-time'];
    if (!et) return new Date();
    const [h, m] = et.split(':').map(n => parseInt(n, 10));
    const d = new Date();
    d.setHours(h ?? 0, m ?? 0, 0, 0);
    return d;
  });
```

Current `useEffect` (lines 36-44):

```ts
  useEffect(() => {
    if (task && !editing) {
      setEditText(task.text);
      setPriority(task.priority);
      setHasEnd(!!task.extensions['end']);
      const end = task.extensions['end'];
      setEndDate(end ? new Date(end.slice(0, 10) + 'T12:00:00') : new Date());
    }
  }, [task]);
```

Change to also re-sync the new state:

```ts
  useEffect(() => {
    if (task && !editing) {
      setEditText(task.text);
      setPriority(task.priority);
      setHasEnd(!!task.extensions['end']);
      const end = task.extensions['end'];
      setEndDate(end ? new Date(end.slice(0, 10) + 'T12:00:00') : new Date());
      setHasEndTime(!!task.extensions['end-time']);
      const et = task.extensions['end-time'];
      if (et) {
        const [h, m] = et.split(':').map(n => parseInt(n, 10));
        const d = new Date();
        d.setHours(h ?? 0, m ?? 0, 0, 0);
        setEndTimeVal(d);
      } else {
        setEndTimeVal(new Date());
      }
    }
  }, [task]);
```

- [ ] **Step 3: Add the immediate-save handler and clamped `onChange`**

After the existing `onEndDateChange` function (lines 119-128), add:

```ts
  async function handleEndTimeChange(timeStr: string | undefined) {
    if (!task) return;
    setHasEndTime(!!timeStr);
    const withoutEndTime = task.text.replace(/(?:^|\s)end-time:\S+/g, '').trim();
    const newText = timeStr ? `${withoutEndTime} end-time:${timeStr}` : withoutEndTime;
    try {
      const result = applyEdit([...tasks], lineNum, newText, todayStr);
      await save(result.tasks);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  function onEndTimeValChange(_: DateTimePickerEvent, t?: Date) {
    if (!t || !task) return;
    const startVal = task.extensions['start'];
    const startMinutes = startVal && startVal.includes('T')
      ? parseInt(startVal.slice(11, 13), 10) * 60 + parseInt(startVal.slice(14, 16), 10)
      : 0;
    const clamped = timeMinutes(t) < startMinutes
      ? (() => { const d = new Date(t); d.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0); return d; })()
      : t;
    setEndTimeVal(clamped);
    handleEndTimeChange(pad(clamped.getHours()) + ':' + pad(clamped.getMinutes()));
  }
```

- [ ] **Step 4: Add the `pad` helper**

Current `dateToISO` helper (lines 170-172):

```ts
  function dateToISO(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
```

This already calls `pad(...)` but `pad` itself is defined just above it (lines 166-168):

```ts
  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }
```

No change needed here — `pad` already exists in this file and Step 3 reuses it directly.

- [ ] **Step 5: Render the "End time" row**

Current End Date section (lines 223-261) ends with:

```tsx
          {hasEnd && (
            <View style={styles.endDateRow}>
              <Text style={styles.endDateLabel}>Ends</Text>
              <DateTimePicker
                mode="date"
                display="compact"
                value={endDate}
                onChange={onEndDateChange}
                accentColor={Colors.accent}
                style={styles.endDatePicker}
              />
            </View>
          )}
        </>
      )}
```

Insert a new, independently-gated block right after that closing `)}`/`</>` — i.e. change the tail to:

```tsx
          {hasEnd && (
            <View style={styles.endDateRow}>
              <Text style={styles.endDateLabel}>Ends</Text>
              <DateTimePicker
                mode="date"
                display="compact"
                value={endDate}
                onChange={onEndDateChange}
                accentColor={Colors.accent}
                style={styles.endDatePicker}
              />
            </View>
          )}
        </>
      )}

      {task.extensions['type'] === 'event' && !!task.extensions['start']?.includes('T') && (
        <>
          <Text style={styles.label}>End Time</Text>
          <View style={styles.endDateRow}>
            <Text style={styles.endDateLabel}>Has end time</Text>
            <Switch
              value={hasEndTime}
              onValueChange={v => {
                if (!v) {
                  handleEndTimeChange(undefined);
                  return;
                }
                const startVal = task.extensions['start'];
                const startDate = new Date(
                  parseInt(startVal.slice(0, 4)), parseInt(startVal.slice(5, 7)) - 1, parseInt(startVal.slice(8, 10)),
                  parseInt(startVal.slice(11, 13)), parseInt(startVal.slice(14, 16)),
                );
                const next = defaultEndTime(startDate);
                setEndTimeVal(next);
                handleEndTimeChange(pad(next.getHours()) + ':' + pad(next.getMinutes()));
              }}
              trackColor={{ false: Colors.separator, true: Colors.accent }}
              thumbColor={Colors.text}
              ios_backgroundColor={Colors.separator}
            />
          </View>
          {hasEndTime && (
            <View style={styles.endDateRow}>
              <Text style={styles.endDateLabel}>Ends at</Text>
              <DateTimePicker
                mode="time"
                display="compact"
                value={endTimeVal}
                onChange={onEndTimeValChange}
                accentColor={Colors.accent}
                style={styles.endDatePicker}
              />
            </View>
          )}
        </>
      )}
```

This block sits at the same nesting level as the existing `{task.extensions['type'] === 'event' && !task.extensions['frequency'] && ( ... )}` block (lines 223-261) — i.e. it is its own top-level conditional in the screen, not nested inside the End Date one, since it must render for recurring events too (per the "works for recurring events" requirement), while End Date must not.

- [ ] **Step 6: Manual verification**

Run: `mobile/scripts/sim.sh` (reuse the running instance if still open)

1. Open the event created in earlier tasks' verification. Confirm an **End Time** section appears with a **Has end time** switch already on and **Ends at** showing the time set earlier.
2. Toggle **Has end time** off — confirm the **Ends at** row disappears and the change is saved (go back to Calendar, confirm the row now shows only the single start time).
3. Re-open the event, toggle **Has end time** on — confirm it defaults to start + 1 hour and saves immediately (no separate save step needed).
4. Create (via Add) a **recurring** event with a start time (e.g. weekly standup 9:00 AM), open its Task Detail — confirm the **End Time** section appears even though there's no **End Date** section (recurring events don't get multi-day span UI, but do get end time).
5. Create a plain **task** (not an event) with a time — open its Task Detail, confirm no **End Time** section appears at all.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/task/[line].tsx
git commit -m "feat(mobile): add End Time section to Task Detail for events"
```

---

## Self-Review Notes

- **Spec coverage:** Storage format (Task 2 console + README), Add screen UI (Task 3), Task Detail UI (Task 5), Calendar display (Task 4), auto-snap validation (Task 3 Step 5, Task 5 Step 3), recurring-event support (Task 5's gating condition has no `!frequency` check, unlike End Date) — all covered.
- **Type/name consistency:** `end-time:HH:MM` extension key, `timeMinutes`/`defaultEndTime` helper names, and `hasEndTime`/`endTime`/`endTimeVal` state names are used identically across Tasks 1, 3, and 5.
- **No shared-layer changes** — confirmed consistent with the design's "no `focus.ts` change needed" conclusion; nothing in Tasks 1-5 touches `shared/`.
