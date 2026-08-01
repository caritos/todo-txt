import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import type { Task } from '@shared/parser';
import { birthdayLabel } from '@shared/commands/list';
import { Colors, Fonts, Spacing } from '../theme';

function cleanTitle(text: string): string {
  // Strip key:value extensions from display text, but preserve URL schemes
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').replace(/(?:^|\s)%birthday\b/gi, '').trim();
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
  todayStr: string;
  dateLabel?: string;
  recurrenceLabel?: string;
  isOverdue?: boolean;
  pending?: boolean;
  onPress: () => void;
  onDone: () => void;
  onDelete: () => void;
  onCheckboxPress?: () => void;
};

export function TaskRow({ task, todayStr, dateLabel, recurrenceLabel, isOverdue, pending, onPress, onDone, onDelete, onCheckboxPress }: Props) {
  const title = birthdayLabel(task, todayStr) + cleanTitle(task.text);
  const meta = [dateLabel, recurrenceLabel].filter(Boolean).join('   ');
  const done = task.done;
  // type:event/birthday/anniversary tasks show a diamond instead of a
  // checkbox, mirroring Calendar's agenda row — Search has no other visual
  // cue distinguishing these from plain tasks, so without this a completed
  // event and an untouched checkbox tap look identical to the user.
  const isEvent = !!task.extensions['type'];

  return (
    <Swipeable
      renderRightActions={() => <RightActions onDone={onDone} onDelete={onDelete} />}
      friction={2}
      rightThreshold={40}
    >
      {/* Both this row and the nested checkbox button below use
          gesture-handler's TouchableOpacity, not React Native's core one.
          Swipeable is itself a gesture-handler component, and mixing RN's
          legacy responder system with it for nested touchables (a button
          inside a button) produces unreliable real-device touch arbitration:
          plain-RN-inside-GH showed a press flash that never committed
          (issue #80's "checkbox does nothing"); GH-inside-plain-RN then had
          the outer row win every tap instead (checkbox always navigated).
          Keeping the whole nested hierarchy on one gesture system — GH's
          touchables are built to nest correctly with each other and with
          Swipeable — is what actually resolves it. */}
      <GHTouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.row}>
        <GHTouchableOpacity onPress={() => onCheckboxPress?.()} disabled={!onCheckboxPress} hitSlop={8}>
          {(done || pending) ? (
            <Text style={styles.checkboxDone}>✓</Text>
          ) : isEvent ? (
            <Text style={styles.checkboxEvent}>◆</Text>
          ) : (
            <View style={[styles.checkbox, isOverdue && styles.checkboxOverdue]} />
          )}
        </GHTouchableOpacity>
        <View style={styles.content}>
          <Text style={[styles.title, (done || pending) && styles.titleDone, isOverdue && !done && !pending && styles.titleOverdue]} numberOfLines={3}>{title}</Text>
          {!done && isOverdue && !pending ? (
            <Text style={styles.meta}>
              {dateLabel ? <Text style={styles.metaStrike}>{dateLabel}</Text> : null}
              <Text style={styles.metaOverdue}>{dateLabel ? ' ↑ overdue' : '↑ overdue'}</Text>
              {recurrenceLabel ? <Text>{'   '}{recurrenceLabel}</Text> : null}
            </Text>
          ) : (
            meta && !done ? <Text style={styles.meta}>{meta}</Text> : null
          )}
        </View>
        {task.priority && !done ? (
          <Text style={styles.priority}>{task.priority}</Text>
        ) : null}
      </GHTouchableOpacity>
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
  checkboxDone: { fontSize: 11, color: Colors.textSecondary, width: 17, marginTop: 2, flexShrink: 0 },
  checkboxEvent: { fontSize: 11, color: Colors.accent, width: 17, marginTop: 2, flexShrink: 0, textAlign: 'center' },
  content: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  titleDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  titleOverdue: { color: Colors.accent },
  meta: { fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.2 },
  metaStrike: { fontSize: 11, color: Colors.checkboxBorder, textDecorationLine: 'line-through', letterSpacing: 0.2 },
  metaOverdue: { fontSize: 11, color: Colors.accent, letterSpacing: 0.2 },
  priority: { fontSize: 11, color: Colors.accent, fontWeight: '700', marginTop: 2, flexShrink: 0 },
  actions: { flexDirection: 'row' },
  actionBtn: { justifyContent: 'center', paddingHorizontal: Spacing.md, minWidth: 72 },
  actionText: { color: Colors.textOnAccent, fontWeight: '600', fontSize: 14 },
});
