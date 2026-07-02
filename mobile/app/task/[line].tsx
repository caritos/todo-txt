import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { useTasks } from '../../src/context/TaskContext';
import { PriorityPicker } from '../../src/components/PriorityPicker';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { applyEdit } from '@shared/commands/edit';
import { applyPri, applyDepri } from '@shared/commands/pri';
import { applySkip } from '@shared/commands/skip';
import { Colors, Fonts, Spacing } from '../../src/theme';
import { today, formatDateLabel } from '../../src/utils';
import { taskOccurrence } from '@shared/commands/focus';
import { computeYearCount, birthdayLabel } from '@shared/commands/list';

export default function TaskDetail() {
  const { line } = useLocalSearchParams<{ line: string }>();
  const router = useRouter();
  const { tasks, save } = useTasks();
  const todayStr = today();

  const lineNum = parseInt(line ?? '0', 10);
  const task = useMemo(() => tasks.find(t => t.line === lineNum), [tasks, lineNum]);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task?.text ?? '');
  const [priority, setPriority] = useState<string | undefined>(task?.priority);

  useEffect(() => {
    if (task && !editing) {
      setEditText(task.text);
      setPriority(task.priority);
    }
  }, [task]);

  if (!task) {
    return (
      <View style={styles.sheet}>
        <Text style={styles.errorText}>Task not found.</Text>
      </View>
    );
  }

  const isRecurring = !!(task.extensions['frequency'] && task.extensions['start']);
  const occurrence = task.extensions['start'] ? taskOccurrence(task, todayStr) : null;
  const dueDate = occurrence?.date ?? task.extensions['start']?.slice(0, 10);
  const years = computeYearCount(task, todayStr);

  async function handleDone() {
    try {
      const result = applyDone([...tasks], [lineNum], todayStr);
      await save(result.tasks);
      router.back();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleSaveEdit() {
    try {
      const result = applyEdit([...tasks], lineNum, editText, todayStr);
      await save(result.tasks);
      setEditing(false);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handlePriorityChange(p: string | undefined) {
    setPriority(p);
    try {
      let result: { tasks: typeof tasks };
      if (p) {
        result = applyPri([...tasks], lineNum, p);
      } else {
        // applyDepri throws if no priority — guard against that
        if (!task?.priority) return;
        result = applyDepri([...tasks], lineNum);
      }
      await save(result.tasks);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleSkip() {
    try {
      const result = applySkip([...tasks], lineNum, todayStr);
      await save(result.tasks);
      router.back();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleDelete() {
    const msg = isRecurring
      ? 'This deletes all future occurrences. Use Skip to skip just this one.'
      : 'This cannot be undone.';
    Alert.alert('Delete Task', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = applyRm([...tasks], [lineNum]);
            await save(result.tasks);
            router.back();
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          }
        },
      },
    ]);
  }

  function cleanTitle(text: string): string {
    return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').replace(/(?:^|\s)%birthday\b/gi, '').trim();
  }

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.handleRow}>
        <View style={styles.handle} />
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.titleRow}>
        {editing ? (
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
        ) : (
          <Text style={styles.title}>{birthdayLabel(task, todayStr) + cleanTitle(task.text)}</Text>
        )}
      </View>

      {task.extensions['start'] && dueDate && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>DUE</Text>
          <Text style={[
            styles.dueValue,
            !task.done && dueDate < todayStr && styles.dueOverdue,
          ]}>
            {formatDateLabel(dueDate)}
          </Text>
        </View>
      )}

      {years !== undefined && (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>AGE</Text>
          <Text style={styles.dueValue}>{years} years</Text>
        </View>
      )}

      {!task.extensions['type'] && (
        <>
          <Text style={styles.label}>Priority</Text>
          <PriorityPicker value={priority} onChange={handlePriorityChange} />
        </>
      )}

      <View style={styles.actions}>
        {!task.done && (
          <ActionButton label="Done" color={Colors.accent} onPress={handleDone} />
        )}
        {editing ? (
          <ActionButton label="Save Edit" color={Colors.accent} onPress={handleSaveEdit} />
        ) : (
          <ActionButton label="Edit" color={Colors.textSecondary} onPress={() => setEditing(true)} />
        )}
        {isRecurring && !task.done && (
          <ActionButton label="Skip" color={Colors.textSecondary} onPress={handleSkip} />
        )}
        <ActionButton label="Delete" color={Colors.actionDelete} onPress={handleDelete} />
      </View>


    </ScrollView>
  );
}

function ActionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Colors.surface },
  // height: 44 (not paddingVertical sized for the 4px handle alone) — closeBtn
  // below is absolutely positioned with top:0/bottom:0, which stretches its
  // rendered box to match this row's height. A row sized only for the drag
  // handle left no room for the ✕ (lineHeight 26) to render without
  // overflowing off-screen near the sheet's rounded top corner.
  handleRow: { alignItems: 'center', justifyContent: 'center', height: 44, position: 'relative' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator },
  closeBtn: { position: 'absolute', left: Spacing.md, top: 0, bottom: 0, justifyContent: 'center', padding: Spacing.sm },
  closeText: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300', lineHeight: 26 },
  titleRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  title: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, lineHeight: 22 },
  editInput: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: Spacing.xs,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontFamily: Fonts.mono,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  actionBtn: { borderWidth: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  actionLabel: { fontSize: 15, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 },
  metaLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, width: 40 },
  dueValue: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text },
  dueOverdue: { color: Colors.accent },
  errorText: { color: Colors.textSecondary, padding: Spacing.lg },
});
