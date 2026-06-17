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
import { useState, useRef } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTasks } from '../context/TaskContext';
import type { Task } from '@shared/parser';
import { applyAdd } from '@shared/commands/add';
import { RecurrencePicker, recurrenceExtensions, recurrenceLabel } from './RecurrencePicker';
import type { RecurrenceValue, CustomConfig } from './RecurrencePicker';
import { CustomRecurrencePicker, customRecurrenceExtensions } from './CustomRecurrencePicker';
import { Colors, Fonts, Spacing } from '../theme';
import { today } from '../utils';

type AddType = 'task' | 'event';
type Priority = 'A' | 'B' | 'C' | 'none';
type TagSigil = '+' | '@' | '%' | '~';

type Props = { visible: boolean; onClose: () => void };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTagPrefix(text: string): { type: TagSigil; partial: string } | null {
  const words = text.split(' ');
  const last = words[words.length - 1]!;
  if (last.startsWith('+')) return { type: '+', partial: last };
  if (last.startsWith('@')) return { type: '@', partial: last };
  if (last.startsWith('%')) return { type: '%', partial: last };
  if (last.startsWith('~')) return { type: '~', partial: last };
  return null;
}

function collectTags(tasks: Task[], type: TagSigil, partial: string): string[] {
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\S+`, 'g');
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
  const [showMore, setShowMore] = useState(false);
  const [customConfig, setCustomConfig] = useState<CustomConfig>({ n: 1, unit: 'month' });
  const [hasDate, setHasDate] = useState(false);

  const tagPrefix = getTagPrefix(title);
  const suggestions: string[] = tagPrefix ? collectTags(tasks, tagPrefix.type, tagPrefix.partial) : [];

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
    const parts: string[] = [title.trim()];

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

    if (addType === 'event') parts.push('type:event');

    const text =
      priority !== 'none' ? `(${priority}) ${parts.join(' ')}` : parts.join(' ');

    try {
      const { tasks: updated } = applyAdd([...tasks], text, todayStr);
      await save(updated);
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
      onShow={() => inputRef.current?.focus()}
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
          {/* Title input — always visible */}
          <View style={styles.titleBlock}>
            <TextInput
              ref={inputRef}
              style={styles.titleInput}
              placeholder={addType === 'task' ? 'What needs to be done?' : 'Event name'}
              placeholderTextColor={Colors.textDim}
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
  addBtnDim: { color: Colors.textDim },

  typeToggle: { flexDirection: 'row' },
  typeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  typeBtnRight: { borderLeftWidth: 0 },
  typeBtnActive: { borderColor: Colors.accent, borderLeftWidth: 1 },
  typeBtnText: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: Colors.checkboxBorder },
  typeBtnTextActive: { color: Colors.accent },

  scroll: { flexGrow: 1 },

  titleBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  titleInput: {
    fontFamily: Fonts.mono,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },

  suggestionsRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.inputBg,
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
    borderBottomColor: Colors.divider,
  },
  frowLast: { borderBottomWidth: 0 },
  flabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  fnone: { fontSize: 14, color: Colors.textSecondary },
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
  pchipText: { fontSize: 12, color: Colors.checkboxBorder, fontFamily: Fonts.mono },
  pchipTextActive: { color: Colors.accent },

  errorText: { color: Colors.accent, fontSize: 13, margin: Spacing.md, textAlign: 'center' },

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
});
