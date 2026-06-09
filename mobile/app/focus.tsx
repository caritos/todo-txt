import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { CalendarHeader } from '../src/components/CalendarHeader';
import { TaskRow } from '../src/components/TaskRow';
import { EventPill } from '../src/components/EventPill';
import { applyFocus } from '@shared/commands/focus';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Spacing } from '../src/theme';
import { today, formatDateLabel, sectionHeader } from '../src/utils';
import * as Haptics from 'expo-haptics';
import type { FocusItem } from '@shared/commands/focus';

type Section = { title: string; date: string; data: FocusItem[] };

export default function FocusScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { sections, dotDates } = useMemo(() => {
    const items = applyFocus(tasks, todayStr);
    const dots = new Set(items.map(fi => fi.effectiveDate.slice(0, 10)));
    const byDate = new Map<string, FocusItem[]>();
    for (const item of items) {
      const date = item.effectiveDate.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(item);
    }
    const sects: Section[] = [...byDate.entries()].map(([date, data]) => ({
      title: sectionHeader(date, todayStr),
      date,
      data,
    }));
    return { sections: sects, dotDates: dots };
  }, [tasks, todayStr]);

  async function handleDone(lineNum: number) {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }

  async function handleDelete(lineNum: number) {
    const { tasks: updated } = applyRm([...tasks], [lineNum]);
    await save(updated);
  }

  return (
    <View style={styles.screen}>
      <CalendarHeader
        today={todayStr}
        selectedDate={selectedDate}
        dotDates={dotDates}
        onSelectDate={setSelectedDate}
      />
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.task.line)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isEvent = !!item.task.extensions['type'];
          const dateLabel = formatDateLabel(item.effectiveDate);
          if (isEvent) {
            return (
              <EventPill
                task={item.task}
                dateLabel={dateLabel}
                onPress={() => router.push(`/task/${item.task.line}` as any)}
              />
            );
          }
          return (
            <TaskRow
              task={item.task}
              dateLabel={dateLabel}
              recurrenceLabel={item.recurrenceLabel || undefined}
              isOverdue={item.effectiveDate.slice(0, 10) < todayStr}
              onPress={() => router.push(`/task/${item.task.line}` as any)}
              onDone={() => handleDone(item.task.line)}
              onDelete={() => handleDelete(item.task.line)}
            />
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nothing in focus for the next 2 weeks.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
        stickySectionHeadersEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontWeight: '600',
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic' },
});
