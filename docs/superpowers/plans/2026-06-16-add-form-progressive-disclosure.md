# Add Form Progressive Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `AddTaskModal` so it opens collapsed (title input + SHOW MORE link) and expands to reveal Start date toggle, Time sub-toggle, Repeat, and Priority on demand.

**Architecture:** All changes are contained in `mobile/src/components/AddTaskModal.tsx`. Two new boolean state fields (`showMore`, `hasDate`) drive visibility. `handleAdd` gates `start:` and recurrence extensions on `hasDate`. No other files change.

**Tech Stack:** React Native, Expo SDK 52, `@react-native-community/datetimepicker`, existing design tokens in `mobile/src/theme.ts`.

---

## File Map

| File | Change |
|------|--------|
| `mobile/src/components/AddTaskModal.tsx` | All changes — state, handleAdd, render, styles |
| `mobile/src/components/RecurrencePicker.tsx` | No changes |

---

## Task 1: Add `Switch` import, new state, and update `reset()`

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

- [ ] **Step 1: Add `Switch` to the React Native import**

Replace the existing import line:
```ts
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
```
With:
```ts
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
```

- [ ] **Step 2: Add `showMore` and `hasDate` state after the existing `const [error, setError]` line**

```ts
const [showMore, setShowMore] = useState(false);
const [hasDate, setHasDate] = useState(false);
```

- [ ] **Step 3: Update `reset()` to clear both new fields**

Replace the existing `reset()` body:
```ts
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
  setPriority('none');
  setError('');
}
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): add showMore/hasDate state to AddTaskModal"
```

---

## Task 2: Update `handleAdd` to gate `start:` and recurrence on `hasDate`

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

- [ ] **Step 1: Replace the `handleAdd` build-parts block**

Find and replace this section inside `handleAdd` (the block that constructs `startExt`, `freqExt`, `parts`, and `text`):

**Before:**
```ts
const todayStr = today();
const dateStr = dateToISO(date);
const startExt = hasTime
  ? `start:${dateStr}T${pad(time.getHours())}:${pad(time.getMinutes())}`
  : `start:${dateStr}`;

const freqExt = recurrenceExtensions(repeat);
const parts: string[] = [title.trim(), startExt];
if (freqExt) parts.push(freqExt);
if (addType === 'event') parts.push('type:event');

const text =
  priority !== 'none' ? `(${priority}) ${parts.join(' ')}` : parts.join(' ');
```

**After:**
```ts
const todayStr = today();
const parts: string[] = [title.trim()];

if (hasDate) {
  const dateStr = dateToISO(date);
  const startExt = hasTime
    ? `start:${dateStr}T${pad(time.getHours())}:${pad(time.getMinutes())}`
    : `start:${dateStr}`;
  parts.push(startExt);
  const freqExt = recurrenceExtensions(repeat);
  if (freqExt) parts.push(freqExt);
}

if (addType === 'event') parts.push('type:event');

const text =
  priority !== 'none' ? `(${priority}) ${parts.join(' ')}` : parts.join(' ');
```

When `hasDate` is false, no `start:` is in `parts`, so `buildAddRaw` auto-injects `start:today` (per the `add` command invariant documented in `CLAUDE.md`).

- [ ] **Step 2: Verify build compiles — run tests**

```bash
bun test shared/
```

Expected: all shared tests pass (no shared logic changed, just confirming no import errors).

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): gate start/repeat on hasDate in AddTaskModal.handleAdd"
```

---

## Task 3: Replace the scroll body with collapsed/expanded rendering

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx`

This task replaces everything inside `<ScrollView ... contentContainerStyle={styles.scroll}>` … `</ScrollView>` with the new conditional structure. The header and `<KeyboardAvoidingView>` wrapper are untouched.

- [ ] **Step 1: Add new styles to the StyleSheet** (must come before render changes so the style keys exist)

Inside `StyleSheet.create({...})`, add these three entries after the existing `errorText` entry:

```ts
showMoreRow: {
  alignItems: 'center',
  paddingVertical: 16,
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: Colors.separator,
},
showMoreText: {
  fontSize: 11,
  color: Colors.accent,
  fontWeight: '600',
  letterSpacing: 1.5,
},
frowNoBottom: { borderBottomWidth: 0 },
```

- [ ] **Step 2: Replace the ScrollView body**

Replace the entire contents of the ScrollView (everything between `<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>` and its closing `</ScrollView>`) with:

```tsx
{/* Title input — always visible */}
<View style={styles.titleBlock}>
  <TextInput
    ref={inputRef}
    style={styles.titleInput}
    placeholder={addType === 'task' ? 'What needs to be done?' : 'Event name'}
    placeholderTextColor="#444444"
    value={title}
    onChangeText={setTitle}
    returnKeyType="done"
    onSubmitEditing={handleAdd}
  />
</View>

{/* Tag suggestions — always visible when typing a tag */}
{suggestions.length > 0 && (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.suggestionsRow}
    contentContainerStyle={styles.suggestionsContent}
    keyboardShouldPersistTaps="always"
  >
    {suggestions.map(tag => (
      <TouchableOpacity
        key={tag}
        style={styles.suggChip}
        onPress={() => applySuggestion(tag)}
      >
        <Text style={styles.suggChipText}>{tag}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
)}

{/* SHOW MORE — collapsed state */}
{!showMore && (
  <TouchableOpacity
    style={styles.showMoreRow}
    onPress={() => setShowMore(true)}
  >
    <Text style={styles.showMoreText}>SHOW MORE</Text>
  </TouchableOpacity>
)}

{/* Expanded groups */}
{showMore && (
  <>
    {/* Group 1: Start date */}
    <View style={styles.group}>
      <View style={[styles.frow, !hasDate && styles.frowLast]}>
        <Text style={styles.flabel}>Start date</Text>
        <Switch
          value={hasDate}
          onValueChange={v => {
            setHasDate(v);
            if (!v) {
              setHasTime(false);
              setRepeat('none');
              setShowRepeat(false);
            }
          }}
          trackColor={{ false: Colors.separator, true: Colors.accent }}
          thumbColor={Colors.text}
          ios_backgroundColor={Colors.separator}
        />
      </View>

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

          {hasTime && (
            <View style={styles.frow}>
              <Text style={styles.flabel} />
              <View style={styles.timeSet}>
                <DateTimePicker
                  mode="time"
                  display="compact"
                  value={time}
                  onChange={onTimeChange}
                  accentColor={Colors.accent}
                  style={styles.compactPicker}
                />
                <TouchableOpacity
                  onPress={() => setHasTime(false)}
                  style={styles.timeClear}
                >
                  <Text style={styles.timeClearText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.frow, styles.frowLast, showRepeat && styles.frowNoBottom]}
            onPress={() => setShowRepeat(r => !r)}
          >
            <Text style={styles.flabel}>Repeat</Text>
            <Text style={repeat === 'none' ? styles.fnone : styles.fval}>
              {recurrenceLabel(repeat)}
            </Text>
          </TouchableOpacity>
          {showRepeat && (
            <RecurrencePicker
              value={repeat}
              onChange={r => {
                setRepeat(r);
                setShowRepeat(false);
              }}
            />
          )}
        </>
      )}
    </View>

    {/* Group 2: Priority — task type only */}
    {addType === 'task' && (
      <View style={styles.group}>
        <View style={[styles.frow, styles.frowLast]}>
          <Text style={styles.flabel}>Priority</Text>
          <View style={styles.pchips}>
            {(['A', 'B', 'C', 'none'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.pchip, priority === p && styles.pchipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.pchipText, priority === p && styles.pchipTextActive]}>
                  {p === 'none' ? '—' : p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    )}
  </>
)}

{error ? <Text style={styles.errorText}>{error}</Text> : null}

<View style={{ height: 40 }} />
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): progressive disclosure render structure in AddTaskModal"
```

---

## Task 4: Manual verification

**Files:** none — verification only

- [ ] **Step 1: Build and run on simulator**

```bash
mobile/scripts/sim.sh
```

- [ ] **Step 2: Verify collapsed state**

Open the add task modal (tap `+` in BottomActionBar). Confirm:
- Only the title input is visible (auto-focused, keyboard up)
- `SHOW MORE` appears below a thin separator line in accent red
- No date, time, repeat, or priority fields are visible
- Typing a `+tag` shows autocomplete chips above SHOW MORE

- [ ] **Step 3: Verify quick-add with no details**

Type "buy milk" and tap Add. Confirm the task appears in the Tasks view with `start:today` (shows "today" label). The task list should reflect it immediately.

- [ ] **Step 4: Verify expanded state — Start date OFF**

Open modal, tap SHOW MORE. Confirm:
- SHOW MORE disappears
- Group 1 shows "Start date" row with Switch OFF
- Group 2 shows "Priority" row with `—` selected
- No Date, Time, or Repeat rows visible yet

- [ ] **Step 5: Verify expanded state — Start date ON**

Tap the Start date Switch. Confirm:
- Switch turns accent-red (ON)
- Date row appears (today's date in compact picker)
- Time row appears (Switch OFF)
- Repeat row appears showing "Never"

- [ ] **Step 6: Verify Time sub-toggle**

Tap the Time Switch. Confirm:
- Time picker appears below the Time row
- Tapping `✕` next to the time picker hides it and turns the switch OFF

- [ ] **Step 7: Verify Repeat inline picker**

Tap the Repeat row. Confirm RecurrencePicker expands inline with 6 options. Select "Every Week". Confirm Repeat row now shows "Every Week" in accent color and picker closes.

- [ ] **Step 8: Verify Start date OFF resets children**

With Start date ON, Time ON, Repeat set to "Every Week": toggle Start date OFF. Confirm Date/Time/Repeat rows disappear. Toggle Start date back ON: Time is OFF and Repeat is "Never" (reset).

- [ ] **Step 9: Verify add with full details**

Set Start date ON, pick a future date, enable Time, set Repeat to "Every Month", Priority to A. Tap Add. Open the task detail for the new task and confirm the raw text shows `start:<date>T<time> frequency:monthly (A)`.

- [ ] **Step 10: Verify EVENT type hides Priority**

Switch TASK/EVENT toggle to EVENT. Expand (SHOW MORE). Confirm Priority group is absent.

- [ ] **Step 11: Commit final**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): progressive disclosure add form — always starts collapsed"
```
