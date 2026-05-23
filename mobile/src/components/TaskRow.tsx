import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import type { Task } from '@shared/parser';
import { Colors, Fonts, Spacing } from '../theme';

function cleanTitle(text: string): string {
  // Strip key:value extensions from display text, but preserve URL schemes
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function RightActions({ onDone, onDelete }: { onDone: () => void; onDelete: () => void }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.actionDone }]} onPress={onDone}>
        <Text style={styles.actionText}>Done</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.actionDelete }]} onPress={onDelete}>
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  task: Task;
  dateLabel?: string;
  recurrenceLabel?: string;
  isOverdue?: boolean;
  onPress: () => void;
  onDone: () => void;
  onDelete: () => void;
};

export function TaskRow({ task, dateLabel, recurrenceLabel, isOverdue, onPress, onDone, onDelete }: Props) {
  const title = cleanTitle(task.text);
  const meta = [dateLabel, recurrenceLabel].filter(Boolean).join('   ');

  return (
    <Swipeable
      renderRightActions={() => <RightActions onDone={onDone} onDelete={onDelete} />}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.row}>
        <View style={[styles.checkbox, isOverdue && styles.checkboxOverdue]} />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={3}>{title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        {task.priority ? (
          <Text style={styles.priority}>{task.priority}</Text>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderWidth: 1.5,
    borderColor: Colors.checkboxBorder,
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxOverdue: { borderColor: Colors.accent },
  content: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  meta: { fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.2 },
  priority: { fontSize: 11, color: Colors.accent, fontWeight: '700', marginTop: 2, flexShrink: 0 },
  actions: { flexDirection: 'row' },
  actionBtn: { justifyContent: 'center', paddingHorizontal: Spacing.md, minWidth: 72 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
