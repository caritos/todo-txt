import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Task } from '@shared/parser';
import { Colors, Fonts, Spacing } from '../theme';

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

type Props = {
  task: Task;
  dateLabel?: string;
  onPress: () => void;
};

export function EventPill({ task, dateLabel, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.pill}>
      <Text style={styles.title} numberOfLines={1}>{cleanTitle(task.text)}</Text>
      {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginHorizontal: Spacing.md,
    marginVertical: 3,
    backgroundColor: Colors.accent + '22',
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flex: 1 },
  date: { fontSize: 11, color: Colors.textSecondary, marginLeft: Spacing.sm, flexShrink: 0 },
});
