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
import { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { parseLine } from '@shared/parser';
import { buildAddRaw } from '@shared/commands/add';
import { parseNaturalLanguage } from '../nlParser';
import { RecurrencePicker, recurrenceExtensions } from './RecurrencePicker';
import type { RecurrenceValue } from './RecurrencePicker';
import { Colors, Spacing } from '../theme';
import { today } from '../utils';

type Mode = 'nl' | 'structured';
type Props = { visible: boolean; onClose: () => void };

export function AddTaskModal({ visible, onClose }: Props) {
  const { tasks, save } = useTasks();
  const [mode, setMode] = useState<Mode>('nl');
  const [nlText, setNlText] = useState('');
  const [structText, setStructText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>('none');
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setNlText('');
    setStructText('');
    setStartDate('');
    setDueDate('');
    setRecurrence('none');
    setShowRecurrence(false);
    setError('');
    setMode('nl');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleAdd() {
    setError('');
    const todayStr = today();
    let raw: string;
    try {
      if (mode === 'nl') {
        if (!nlText.trim()) {
          setError('Please enter a task.');
          return;
        }
        const parsed = parseNaturalLanguage(nlText.trim(), todayStr);
        raw = parsed.raw;
      } else {
        if (!structText.trim()) {
          setError('Please enter task text.');
          return;
        }
        const parts: string[] = [structText.trim()];
        if (startDate) parts.push(`start:${startDate}`);
        if (dueDate) parts.push(`due:${dueDate}`);
        const ext = recurrenceExtensions(recurrence);
        if (ext) parts.push(ext);
        raw = buildAddRaw(parts.join(' '), todayStr);
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const newTask = parseLine(raw, tasks.length + 1);
    await save([...tasks, newTask]);
    handleClose();
  }

  const QUICK_CHARS = ['/', ':', '-', '.', 'T'];

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
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Task</Text>
          <TouchableOpacity onPress={handleAdd}>
            <Text style={styles.add}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            onPress={() => setMode('nl')}
            style={[styles.modeBtn, mode === 'nl' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'nl' && styles.modeBtnTextActive]}>
              Natural language
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('structured')}
            style={[styles.modeBtn, mode === 'structured' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeBtnText, mode === 'structured' && styles.modeBtnTextActive]}>
              Structured
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          {mode === 'nl' ? (
            <View style={styles.nlSection}>
              <TextInput
                style={styles.nlInput}
                placeholder="e.g. call dentist tomorrow at 2pm (A)"
                placeholderTextColor={Colors.textSecondary}
                value={nlText}
                onChangeText={setNlText}
                multiline
                autoFocus
              />
              <View style={styles.quickRow}>
                {QUICK_CHARS.map(ch => (
                  <TouchableOpacity
                    key={ch}
                    style={styles.quickBtn}
                    onPress={() => setNlText(t => t + ch)}
                  >
                    <Text style={styles.quickChar}>{ch}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.formSection}>
              <Text style={styles.fieldLabel}>Task text</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="What needs to be done?"
                placeholderTextColor={Colors.textSecondary}
                value={structText}
                onChangeText={setStructText}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Start date (YYYY-MM-DD or YYYY-MM-DDTHH:MM)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 2026-05-24T09:00"
                placeholderTextColor={Colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.fieldLabel}>Due date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 2026-05-31"
                placeholderTextColor={Colors.textSecondary}
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="numbers-and-punctuation"
              />

              <TouchableOpacity
                onPress={() => setShowRecurrence(r => !r)}
                style={styles.recurrenceToggle}
              >
                <Text style={styles.fieldLabel}>Recurrence</Text>
                <Text style={styles.recurrenceValue}>
                  {recurrence === 'none' ? 'Never' : recurrence} ›
                </Text>
              </TouchableOpacity>
              {showRecurrence && (
                <RecurrencePicker value={recurrence} onChange={setRecurrence} />
              )}
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  cancel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  add: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
  },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.accent,
  },
  modeBtnText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  nlSection: {
    margin: Spacing.md,
  },
  nlInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  quickRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  quickBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  quickChar: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  formSection: {
    margin: Spacing.md,
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + Spacing.xs,
    color: Colors.text,
    fontSize: 15,
  },
  recurrenceToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  recurrenceValue: {
    fontSize: 14,
    color: Colors.accent,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    margin: Spacing.md,
    textAlign: 'center',
  },
});
