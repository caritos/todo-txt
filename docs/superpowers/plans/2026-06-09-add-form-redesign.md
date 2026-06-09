# Add Form Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AddTaskModal` with a Fantastical-inspired structured form — Task/Event toggle, native date/time picker, inline tag suggestions, priority chips; no NL mode, no due date.

**Architecture:** The existing `AddTaskModal.tsx` is rewritten in place. `RecurrencePicker.tsx` gains a `recurrenceLabel()` helper. `@react-native-community/datetimepicker` provides the native iOS compact date/time control. No new files, no shared-layer changes.

**Tech Stack:** React Native, `@react-native-community/datetimepicker`, existing `RecurrencePicker`, `buildAddRaw` from `@shared/commands/add`, `parseLine` from `@shared/parser`.

---

### Task 1: Install dependency and add `recurrenceLabel`

**Files:**
- Modify: `mobile/package.json` (via `npx expo install`)
- Modify: `mobile/src/components/RecurrencePicker.tsx`

- [ ] **Step 1: Install `@react-native-community/datetimepicker`**

```bash
cd mobile && npx expo install @react-native-community/datetimepicker
```

Expected: package added to `mobile/package.json` under `dependencies`. No build step yet — the package is installed into `node_modules`.

- [ ] **Step 2: Add `recurrenceLabel` export to `RecurrencePicker.tsx`**

Open `mobile/src/components/RecurrencePicker.tsx`. The `OPTIONS` array is already defined at the top. Add this function after `recurrenceExtensions`:

```typescript
export function recurrenceLabel(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.label ?? 'Never';
}
```

Full updated file (replace entirely):

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export type RecurrenceValue =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

const OPTIONS: { label: string; value: RecurrenceValue; extensions: string }[] = [
  { label: 'Never', value: 'none', extensions: '' },
  { label: 'Every Day', value: 'daily', extensions: 'frequency:daily' },
  { label: 'Every Week', value: 'weekly', extensions: 'frequency:weekly' },
  { label: 'Every 2 Weeks', value: 'biweekly', extensions: 'frequency:weekly every:2' },
  { label: 'Every Month', value: 'monthly', extensions: 'frequency:monthly' },
  { label: 'Every Year', value: 'yearly', extensions: 'frequency:yearly' },
];

export function recurrenceExtensions(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.extensions ?? '';
}

export function recurrenceLabel(value: RecurrenceValue): string {
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
          {opt.value === value && <Text style={styles.check}>✓</Text>}
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

- [ ] **Step 3: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/src/components/RecurrencePicker.tsx
git commit -m "feat(mobile): install datetimepicker, add recurrenceLabel helper"
```

---

### Task 2: Rewrite AddTaskModal

**Files:**
- Modify: `mobile/src/components/AddTaskModal.tsx` (complete replacement)

- [ ] **Step 1: Replace `mobile/src/components/AddTaskModal.tsx` entirely**

```typescript
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
import { useState, useRef } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTasks } from '../context/TaskContext';
import { parseLine } from '@shared/parser';
import type { Task } from '@shared/parser';
import { buildAddRaw } from '@shared/commands/add';
import { RecurrencePicker, recurrenceExtensions, recurrenceLabel } from './RecurrencePicker';
import type { RecurrenceValue } from './RecurrencePicker';
import { Colors, Fonts, Spacing } from '../theme';
import { today } from '../utils';

type AddType = 'task' | 'event';
type Priority = 'A' | 'B' | 'C' | 'none';

type Props = { visible: boolean; onClose: () => void };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTagPrefix(text: string): { type: '+' | '@'; partial: string } | null {
  const words = text.split(' ');
  const last = words[words.length - 1] ?? '';
  if (last.startsWith('+')) return { type: '+', partial: last };
  if (last.startsWith('@')) return { type: '@', partial: last };
  return null;
}

function collectTags(tasks: Task[], type: '+' | '@', partial: string): string[] {
  const regex = type === '+' ? /\+\S+/g : /@\S+/g;
  const set = new Set<string>();
  for (const t of tasks) {
    for (const m of t.text.matchAll(regex)) set.add(m[0]);
  }
  const lower = partial.toLowerCase();
  return [...set].filter(tag => tag.toLowerCase().startsWith(lower)).sort();
}

export function AddTaskModal({ visible, onClose }: Props) {
  const { tasks, save } = useTasks();
  const inputRef = useRef<TextInput>(null);

  const [addType, setAddType] = useState<AddType>('task');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState(() => new Date());
  const [repeat, setRepeat] = useState<RecurrenceValue>('none');
  const [showRepeat, setShowRepeat] = useState(false);
  const [priority, setPriority] = useState<Priority>('none');
  const [error, setError] = useState('');

  const tagPrefix = getTagPrefix(title);
  const suggestions = tagPrefix ? collectTags(tasks, tagPrefix.type, tagPrefix.partial) : [];

  function reset() {
    setAddType('task');
    setTitle('');
    setDate(new Date());
    setHasTime(false);
    setTime(new Date());
    setRepeat('none');
    setShowRepeat(false);
    setPriority('none');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function applySuggestion(tag: string) {
    const words = title.split(' ');
    words[words.length - 1] = tag;
    setTitle(words.join(' ') + ' ');
    inputRef.current?.focus();
  }

  async function handleAdd() {
    setError('');
    if (!title.trim()) {
      setError('Enter a title.');
      return;
    }
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

    try {
      const raw = buildAddRaw(text, todayStr);
      const newTask = parseLine(raw, tasks.length + 1);
      await save([...tasks, newTask]);
      handleClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onDateChange(_: DateTimePickerEvent, d?: Date) {
    if (d) setDate(d);
  }

  function onTimeChange(_: DateTimePickerEvent, t?: Date) {
    if (t) setTime(t);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.dismiss}>✕</Text>
          </TouchableOpacity>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeBtn, addType === 'task' && styles.typeBtnActive]}
              onPress={() => setAddType('task')}
            >
              <Text style={[styles.typeBtnText, addType === 'task' && styles.typeBtnTextActive]}>
                TASK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, styles.typeBtnRight, addType === 'event' && styles.typeBtnActive]}
              onPress={() => setAddType('event')}
            >
              <Text style={[styles.typeBtnText, addType === 'event' && styles.typeBtnTextActive]}>
                EVENT
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleAdd} disabled={!title.trim()}>
            <Text style={[styles.addBtn, !title.trim() && styles.addBtnDim]}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {/* Title input */}
          <View style={styles.titleBlock}>
            <TextInput
              ref={inputRef}
              style={styles.titleInput}
              placeholder={addType === 'task' ? 'What needs to be done?' : 'Event name'}
              placeholderTextColor="#444444"
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
          </View>

          {/* Tag suggestions */}
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

          {/* Group 1: Date + Time */}
          <View style={styles.group}>
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
            <View style={[styles.frow, styles.frowLast]}>
              <Text style={styles.flabel}>Time</Text>
              {hasTime ? (
                <View style={styles.timeSet}>
                  <DateTimePicker
                    mode="time"
                    display="compact"
                    value={time}
                    onChange={onTimeChange}
                    accentColor={Colors.accent}
                    style={styles.compactPicker}
                  />
                  <TouchableOpacity onPress={() => setHasTime(false)} style={styles.timeClear}>
                    <Text style={styles.timeClearText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setHasTime(true)}>
                  <Text style={styles.fnone}>None</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Group 2: Repeat + Priority */}
          <View style={styles.group}>
            <TouchableOpacity
              style={[styles.frow, addType === 'event' && !showRepeat && styles.frowLast]}
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

            {addType === 'task' && (
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
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.navBar,
  },
  dismiss: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300', lineHeight: 26 },
  addBtn: { fontSize: 15, fontWeight: '600', color: Colors.accent },
  addBtnDim: { color: '#444444' },

  typeToggle: { flexDirection: 'row' },
  typeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.separator,
    borderRightWidth: 0,
  },
  typeBtnRight: { borderRightWidth: 1 },
  typeBtnActive: { borderColor: Colors.accent },
  typeBtnText: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: '#555555' },
  typeBtnTextActive: { color: Colors.accent },

  scroll: { flexGrow: 1 },

  titleBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  titleInput: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },

  suggestionsRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    backgroundColor: '#141414',
  },
  suggestionsContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 7,
    flexDirection: 'row',
  },
  suggChip: {
    borderWidth: 1,
    borderColor: Colors.separator,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  suggChipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary },

  group: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.separator,
    marginTop: 18,
  },
  frow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
  },
  frowLast: { borderBottomWidth: 0 },
  flabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  fnone: { fontSize: 14, color: '#333333' },
  fval: { fontSize: 14, color: Colors.accent },

  compactPicker: { height: 34 },
  timeSet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeClear: { padding: 4 },
  timeClearText: { fontSize: 12, color: Colors.textSecondary },

  pchips: { flexDirection: 'row', gap: Spacing.sm },
  pchip: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: Colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pchipActive: { borderColor: Colors.accent },
  pchipText: { fontSize: 12, color: '#555555', fontFamily: Fonts.mono },
  pchipTextActive: { color: Colors.accent },

  errorText: { color: Colors.accent, fontSize: 13, margin: Spacing.md, textAlign: 'center' },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors. If you see errors about `@react-native-community/datetimepicker` types, run:
```bash
cd mobile && npx expo install @react-native-community/datetimepicker
```
again to ensure the package and its types are present.

- [ ] **Step 3: Rebuild dev client**

The new native module requires a dev client rebuild:

```bash
cd mobile && bash scripts/sim.sh
```

Expected: app launches on simulator with no build errors.

- [ ] **Step 4: Smoke test**

1. Tap `+` — form opens in Task mode with title focused
2. Type `call dentist +h` — tag strip shows matching `+health` chips (if that project exists in todo.txt)
3. Tap `+health` chip — title becomes `call dentist +health `, cursor at end
4. Date row shows today's date as a compact iOS date control in accent color
5. Tap Time "None" — compact time picker appears; ✕ clears it
6. Tap Repeat "Never" — RecurrencePicker expands; select "Every Week"; collapses
7. Tap `A` chip — Priority A selected (accent border + text)
8. Tap `Add` — form closes; new task appears in Focus screen with priority `(A)` and `start:today`
9. Tap `+`, switch to EVENT — Priority row disappears
10. Fill title, tap Add — task has `type:event` in raw

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/AddTaskModal.tsx
git commit -m "feat(mobile): redesign add form — structured only, Task/Event toggle, native date picker"
```
