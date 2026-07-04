# Multi-Day Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user create and edit a single event that spans multiple consecutive days (e.g. "Nina's art class" 2026-07-13 to 2026-07-17), rendering correctly on every day of the span in Calendar (GitHub issue #70).

**Architecture:** Expand `generateTaskOccurrences`'s non-recurring branch to loop from `start:` to `end:` (defaulting to a single day when `end:` is absent), bounded by the existing `effectiveCutoff`. Add an event-only, Repeat-mutually-exclusive "End date" control to `AddTaskModal` (for creation) and an always-visible, immediately-saving "End date" control to Task Detail (for editing), mirroring how Priority already works there.

**Tech Stack:** TypeScript, Bun test (shared), Jest (mobile), Expo Router, React Native, `@react-native-community/datetimepicker`.

**Spec:** `docs/superpowers/specs/2026-07-03-multi-day-events-design.md`

## Global Constraints

- Event-only: the End date UI appears only when `addType === 'event'` (Add form) or `task.extensions['type'] === 'event'` (Task Detail). Plain tasks never get this control.
- Non-recurring only: End date and Repeat are mutually exclusive in both directions — setting one clears the other. Task Detail's End date control is additionally gated on `!task.extensions['frequency']`.
- Auto-snap, no error UI: the date range can never become invalid. No inline error message or blocked Add/Save button for a bad range — the app silently keeps the range valid.
- No new mobile test coverage — `AddTaskModal.tsx` and `task/[line].tsx` have no existing test files, consistent with this codebase's precedent of not unit-testing screen-level UI. Verification for those tasks is `tsc --noEmit` clean plus the existing mobile Jest suite staying green.

---

### Task 1: Expand `generateTaskOccurrences` to honor `end:`

**Files:**
- Modify: `shared/commands/focus.ts:548-553`
- Test: `shared/tests/commands/focus.test.ts`

**Interfaces:**
- Consumes: nothing new — `task.extensions['end']` is already parsed generically by `parseLine`.
- Produces: no signature change to `generateTaskOccurrences(task, fromStr, cutoffStr): Array<{ date: string; task: Task }>` — same exported name, same parameters, same return shape. Tasks 2 and 3 don't call this function directly (Calendar already does, unchanged), so this is purely an internal-behavior change other tasks don't need to know about beyond "it now honors `end:`."

- [ ] **Step 1: Write the failing tests**

Add `generateTaskOccurrences` to the import on line 2 of `shared/tests/commands/focus.test.ts`:
```ts
import { taskOccurrence, nextMonthlyDate, nextYearlyDate, focusSortKey, generateTaskOccurrences } from '../../commands/focus';
```

Then append this new `describe` block at the end of the file (it uses the file's existing local `task(raw)` helper at line 5 — do not redefine it):
```ts
describe('generateTaskOccurrences', () => {
  test('multi-day non-recurring event expands to one occurrence per day', () => {
    const t = task('art class type:event start:2026-07-13 end:2026-07-17');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual([
      '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17',
    ]);
  });

  test('single-day event with no end: still returns exactly one occurrence', () => {
    const t = task('birthday party type:event start:2026-07-13');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual(['2026-07-13']);
  });

  test('span partially outside the query window only returns in-window days', () => {
    const t = task('art class type:event start:2026-07-13 end:2026-07-17');
    const occs = generateTaskOccurrences(t, '2026-07-15', '2026-07-31');
    expect(occs.map(o => o.date)).toEqual(['2026-07-15', '2026-07-16', '2026-07-17']);
  });

  test('garbage far-future end: does not loop past effectiveCutoff', () => {
    const t = task('art class type:event start:2026-07-13 end:2099-01-01');
    const occs = generateTaskOccurrences(t, '2026-07-01', '2026-07-20');
    expect(occs).toHaveLength(8); // 07-13 through 07-20 inclusive
    expect(occs[occs.length - 1]!.date).toBe('2026-07-20');
  });
});
```

- [ ] **Step 2: Run tests to verify the new-behavior cases fail**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared/tests/commands/focus.test.ts`
Expected: the `'multi-day non-recurring event expands to one occurrence per day'`, `'span partially outside the query window...'`, and `'garbage far-future end...'` tests FAIL (current code only ever returns one occurrence, at `startDate`). The `'single-day event with no end: still returns exactly one occurrence'` test PASSES already — it's a regression guard for existing behavior, not new behavior, so seeing it pass now is expected and correct, not a sign something's wrong with the other three failing.

- [ ] **Step 3: Implement the fix**

In `shared/commands/focus.ts`, change lines 548-553 from:
```ts
  if (!freq) {
    if (startDate >= fromStr && startDate <= effectiveCutoff) {
      results.push({ date: startDate, task });
    }
    return results;
  }
```
to:
```ts
  if (!freq) {
    const spanEnd = task.extensions['end']?.slice(0, 10) ?? startDate;
    let cursor = startDate;
    while (cursor <= spanEnd && cursor <= effectiveCutoff) {
      if (cursor >= fromStr) results.push({ date: cursor, task });
      cursor = addDays(cursor, 1);
    }
    return results;
  }
```
(`addDays` is already imported at the top of this file — no new import needed.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared/tests/commands/focus.test.ts`
Expected: all tests in this file pass, including all 4 new ones.

- [ ] **Step 5: Run the full shared+console suite to check for regressions**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, 0 fail (408 = 404 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add shared/commands/focus.ts shared/tests/commands/focus.test.ts
git commit -m "$(cat <<'EOF'
feat(shared): expand generateTaskOccurrences to span start:..end:

A non-recurring event previously only ever produced one occurrence, at
start:, regardless of an end: extension. Loop from start: to end:
(defaulting to a single day when end: is absent) so a multi-day event
actually renders on every day of its span in Calendar. Bounded by the
same effectiveCutoff the recurring branch already uses, so a garbage
far-future end: can't cause an unbounded loop.

Part of #70.
EOF
)"
```

---

### Task 2: Add "End date" to the Add form

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 (this task only builds the `end:` extension string; Task 1's shared-layer change is what makes Calendar render it, already deployed independently).
- Produces: nothing new for Task 3 — the two UI tasks are independent, both driven by the same `end:` extension convention documented in the spec.

- [ ] **Step 1: Add state for the End date control**

In `mobile/src/components/AddTaskModal.tsx`, after the existing line 69 (`const [repeat, setRepeat] = useState<RecurrenceValue>('none');`), add:
```tsx
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(() => new Date());
```

- [ ] **Step 2: Reset the new state on modal close**

In the `reset()` function, change:
```tsx
  function reset() {
    setAddType('task');
    setTitle('');
    setShowMore(false);
    setHasDate(false);
    setDate(new Date());
    setHasTime(false);
    setTime(new Date());
    setRepeat('none');
    setShowRepeat(false);
    setCustomConfig({ n: 1, unit: 'month' });
    setPriority('none');
    setError('');
  }
```
to:
```tsx
  function reset() {
    setAddType('task');
    setTitle('');
    setShowMore(false);
    setHasDate(false);
    setDate(new Date());
    setHasTime(false);
    setTime(new Date());
    setHasEnd(false);
    setEndDate(new Date());
    setRepeat('none');
    setShowRepeat(false);
    setCustomConfig({ n: 1, unit: 'month' });
    setPriority('none');
    setError('');
  }
```

- [ ] **Step 3: Push the `end:` extension when adding**

In `handleAdd()`, change this block (currently lines 113-123):
```tsx
    if (hasDate) {
      const dateStr = dateToISO(date);
      const startExt = hasTime
        ? `start:${dateStr}T${pad(time.getHours())}:${pad(time.getMinutes())}`
        : `start:${dateStr}`;
      parts.push(startExt);
      const freqExt = repeat === 'custom'
        ? customRecurrenceExtensions(customConfig)
        : recurrenceExtensions(repeat);
      if (freqExt) parts.push(freqExt);
    }
```
to:
```tsx
    if (hasDate) {
      const dateStr = dateToISO(date);
      const startExt = hasTime
        ? `start:${dateStr}T${pad(time.getHours())}:${pad(time.getMinutes())}`
        : `start:${dateStr}`;
      parts.push(startExt);
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
(The `if/else` is defensive belt-and-suspenders on top of the UI-level mutual exclusivity added in Step 6 below — even if `repeat` somehow held a stale non-`'none'` value while `hasEnd` was true, this guarantees the two extensions are never both written to the same line.)

- [ ] **Step 4: Snap End date when Start date moves past it**

Change `onDateChange` (currently lines 142-144) from:
```tsx
  function onDateChange(_: DateTimePickerEvent, d?: Date) {
    if (d) setDate(d);
  }
```
to:
```tsx
  function onDateChange(_: DateTimePickerEvent, d?: Date) {
    if (!d) return;
    setDate(d);
    if (hasEnd && dateToISO(d) > dateToISO(endDate)) setEndDate(d);
  }
```

- [ ] **Step 5: Add the End date change handler, clamped to not precede Start**

After `onTimeChange` (currently lines 146-148), add:
```tsx
  function onEndDateChange(_: DateTimePickerEvent, d?: Date) {
    if (!d) return;
    setEndDate(dateToISO(d) < dateToISO(date) ? date : d);
  }
```

- [ ] **Step 6: Insert the End date UI between the Date row and Time row, and wire Repeat's mutual exclusivity**

In the JSX, the Date row currently ends and the Time row begins like this (lines 261-282):
```tsx
                {hasDate && (
                  <>
                    <View style={styles.frow}>
                      <Text style={styles.flabel}>Date</Text>
                      <DateTimePicker
                        mode="date"
                        display="compact"
                        value={date}
                        onChange={onDateChange}
                        accentColor={Colors.accent}
                        style={styles.compactPicker}
                      />
                    </View>

                    <View style={styles.frow}>
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
Insert the new End date rows between them:
```tsx
                {hasDate && (
                  <>
                    <View style={styles.frow}>
                      <Text style={styles.flabel}>Date</Text>
                      <DateTimePicker
                        mode="date"
                        display="compact"
                        value={date}
                        onChange={onDateChange}
                        accentColor={Colors.accent}
                        style={styles.compactPicker}
                      />
                    </View>

                    {addType === 'event' && (
                      <View style={styles.frow}>
                        <Text style={styles.flabel}>End date</Text>
                        <Switch
                          value={hasEnd}
                          onValueChange={v => {
                            setHasEnd(v);
                            if (v) {
                              setEndDate(date);
                              setRepeat('none');
                              setShowRepeat(false);
                            }
                          }}
                          trackColor={{ false: Colors.separator, true: Colors.accent }}
                          thumbColor={Colors.text}
                          ios_backgroundColor={Colors.separator}
                        />
                      </View>
                    )}

                    {addType === 'event' && hasEnd && (
                      <View style={styles.frow}>
                        <Text style={styles.flabel} />
                        <DateTimePicker
                          mode="date"
                          display="compact"
                          value={endDate}
                          onChange={onEndDateChange}
                          accentColor={Colors.accent}
                          style={styles.compactPicker}
                        />
                      </View>
                    )}

                    <View style={styles.frow}>
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

- [ ] **Step 7: Hide Repeat while End date is active, and clear End date if a Repeat value is picked**

The Repeat trigger and its picker (currently lines 306-331) are:
```tsx
                    <TouchableOpacity
                      style={[styles.frow, styles.frowLast]}
                      onPress={() => setShowRepeat(r => !r)}
                    >
                      <Text style={styles.flabel}>Repeat</Text>
                      <Text style={repeat === 'none' ? styles.fnone : styles.fval}>
                        {recurrenceLabel(repeat, repeat === 'custom' ? customConfig : undefined)}
                      </Text>
                    </TouchableOpacity>
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
Change to:
```tsx
                    {!hasEnd && (
                      <TouchableOpacity
                        style={[styles.frow, styles.frowLast]}
                        onPress={() => setShowRepeat(r => !r)}
                      >
                        <Text style={styles.flabel}>Repeat</Text>
                        <Text style={repeat === 'none' ? styles.fnone : styles.fval}>
                          {recurrenceLabel(repeat, repeat === 'custom' ? customConfig : undefined)}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!hasEnd && showRepeat && (
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
                            if (r !== 'none') setHasEnd(false);
                          }}
                        />
                      )
                    )}
```

- [ ] **Step 8: Apply `frowLast` to whichever row is now visually last**

Since Repeat's row (which carries `frowLast`) is hidden when `hasEnd` is true, the End-date-picker row becomes the last visible row in that case and needs the same treatment to avoid a stray border. In the End-date-picker row added in Step 6, change:
```tsx
                    {addType === 'event' && hasEnd && (
                      <View style={styles.frow}>
```
to:
```tsx
                    {addType === 'event' && hasEnd && (
                      <View style={[styles.frow, styles.frowLast]}>
```

- [ ] **Step 9: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 10: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 79 passed, 79 total` (unchanged — no new mobile tests per Global Constraints).

- [ ] **Step 11: Manual verification — SKIP if you have no simulator-driving tool.**

If you do, run `mobile/scripts/sim.sh` and in the app: tap `+`, switch to EVENT, enter a title, tap SHOW MORE, turn on Start date, turn on End date, confirm it defaults to the same day as Start, change it to a later date, confirm Repeat's row disappears while End date is on, turn End date off and confirm Repeat's row reappears, tap a Repeat option and confirm End date's toggle turns back off. Add the event and confirm in Calendar that it appears on every day of the span. If you don't have simulator access, note in your report that this step was skipped and why (same accepted gap as prior plans in this repo).

- [ ] **Step 12: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/src/components/AddTaskModal.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add End date to the Add Event form

Event-only, mutually exclusive with Repeat in both directions (picking
one clears the other), with dates auto-snapped so the range can never
be invalid: moving Start past End nudges End up, picking an End before
Start clamps it to Start.

Part of #70.
EOF
)"
```

---

### Task 3: Add "End date" editing to Task Detail

**Files:**
- Modify: `mobile/app/task/[line].tsx`

**Interfaces:**
- Consumes: `applyEdit(tasks: Task[], n: number, newText: string, todayStr: string): { tasks: Task[]; updated: Task }` — already imported in this file (line 8), used exactly as `handleSaveEdit` already uses it, just with a differently-constructed `newText`.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Add imports**

Change line 1 of `mobile/app/task/[line].tsx` from:
```tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
```
to:
```tsx
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
```
Then after line 2 (`import { useLocalSearchParams, useRouter } from 'expo-router';`), add:
```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
```

- [ ] **Step 2: Add local date helpers**

After the existing `cleanTitle` function (currently lines 118-120), add:
```tsx
  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function dateToISO(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
```
(This mirrors `AddTaskModal.tsx`'s identical top-level `pad`/`dateToISO` functions. This codebase duplicates small per-screen helpers like this rather than sharing them — see `cleanTitle`, which is already duplicated the same way in this exact file.)

- [ ] **Step 3: Add state for End date, initialized from the task**

Change lines 25-27 from:
```tsx
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task?.text ?? '');
  const [priority, setPriority] = useState<string | undefined>(task?.priority);
```
to:
```tsx
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task?.text ?? '');
  const [priority, setPriority] = useState<string | undefined>(task?.priority);
  const [hasEnd, setHasEnd] = useState(!!task?.extensions['end']);
  const [endDate, setEndDate] = useState(() => {
    const end = task?.extensions['end'];
    return end ? new Date(end.slice(0, 10) + 'T12:00:00') : new Date();
  });
```

- [ ] **Step 4: Resync the new state whenever `task` changes**

Change the `useEffect` at lines 29-34 from:
```tsx
  useEffect(() => {
    if (task && !editing) {
      setEditText(task.text);
      setPriority(task.priority);
    }
  }, [task]);
```
to:
```tsx
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

- [ ] **Step 5: Add the immediate-save End date handler**

After `handlePriorityChange` (currently lines 69-84), add:
```tsx
  async function handleEndDateChange(dateStr: string | undefined) {
    setHasEnd(!!dateStr);
    const withoutEnd = task.text.replace(/(?:^|\s)end:\S+/g, '').trim();
    const newText = dateStr ? `${withoutEnd} end:${dateStr}` : withoutEnd;
    try {
      const result = applyEdit([...tasks], lineNum, newText, todayStr);
      await save(result.tasks);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  function onEndDateChange(_: DateTimePickerEvent, d?: Date) {
    if (!d) return;
    const startVal = task.extensions['start'];
    const startDateOnly = startVal ? startVal.slice(0, 10) : undefined;
    const dStr = dateToISO(d);
    const clampedStr = startDateOnly && dStr < startDateOnly ? startDateOnly : dStr;
    const clampedDate = clampedStr === dStr ? d : new Date(clampedStr + 'T12:00:00');
    setEndDate(clampedDate);
    handleEndDateChange(clampedStr);
  }
```

- [ ] **Step 6: Add the End date section to the JSX, after Priority**

The Priority section and the actions row currently look like this (lines 164-171):
```tsx
      {!task.extensions['type'] && (
        <>
          <Text style={styles.label}>Priority</Text>
          <PriorityPicker value={priority} onChange={handlePriorityChange} />
        </>
      )}

      <View style={styles.actions}>
```
Insert the new section between them:
```tsx
      {!task.extensions['type'] && (
        <>
          <Text style={styles.label}>Priority</Text>
          <PriorityPicker value={priority} onChange={handlePriorityChange} />
        </>
      )}

      {task.extensions['type'] === 'event' && !task.extensions['frequency'] && (
        <>
          <Text style={styles.label}>End Date</Text>
          <View style={styles.endDateRow}>
            <Text style={styles.endDateLabel}>Multi-day</Text>
            <Switch
              value={hasEnd}
              onValueChange={v => handleEndDateChange(v ? dateToISO(endDate) : undefined)}
              trackColor={{ false: Colors.separator, true: Colors.accent }}
              thumbColor={Colors.text}
              ios_backgroundColor={Colors.separator}
            />
          </View>
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

      <View style={styles.actions}>
```

- [ ] **Step 7: Add the two new styles**

In the `styles` object (currently ending at line 238 with `dueOverdue: { color: Colors.accent },`), add after that line:
```tsx
  endDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  endDateLabel: { fontSize: 14, color: Colors.textSecondary },
  endDatePicker: { height: 34 },
```

- [ ] **Step 8: Typecheck**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 9: Run the mobile Jest suite**

Run: `cd /Volumes/robin/src/todo-txt/mobile && npx jest --silent`
Expected: `Test Suites: 6 passed, 6 total`, `Tests: 79 passed, 79 total`.

- [ ] **Step 10: Run the shared+console suite**

Run: `cd /Volumes/robin/src/todo-txt && bun test shared console`
Expected: all pass, 0 fail.

- [ ] **Step 11: Manual verification — SKIP if you have no simulator-driving tool.**

If you do, run `mobile/scripts/sim.sh` and in the app: open an existing multi-day event's Task Detail (created via Task 2's Add form), confirm the "End Date" section shows "Multi-day" on with the correct Ends date, change the Ends date, confirm it saves immediately (no Save button needed) and Calendar reflects the new span. Also open a plain task's and a recurring event's Task Detail and confirm the End Date section does not appear for either. If you don't have simulator access, note in your report that this step was skipped and why.

- [ ] **Step 12: Commit**

```bash
cd /Volumes/robin/src/todo-txt
git add mobile/app/task/\[line\].tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add End date editing to Task Detail (closes #70)

Mirrors how Priority already works here: an always-visible control that
saves immediately via applyEdit, independent of the title's free-text
Edit/Save Edit flow. Shown only for non-recurring events, matching the
Add form's mutual-exclusivity rule with Repeat.
EOF
)"
```
