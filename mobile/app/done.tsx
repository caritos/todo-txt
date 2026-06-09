import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today, sectionHeader } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function frequencyLabel(task: Task): string {
  const f = task.extensions['frequency'];
  return f ? ` · ${f}` : '';
}

function dayLabel(dateStr: string, todayStr: string): string {
  const yesterday = addDays(todayStr, -1);
  if (dateStr === todayStr) return 'today';
  if (dateStr === yesterday) return 'yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]!;
}

type Section = { title: string; date: string; data: Task[] };

export default function DoneScreen() {
  const { tasks } = useTasks();
  const todayStr = today();

  const sections = useMemo<Section[]>(() => {
    const thirtyDaysAgo = addDays(todayStr, -29);
    const done = tasks
      .filter(t => t.done && t.completionDate && t.completionDate >= thirtyDaysAgo)
      .sort((a, b) => b.completionDate!.localeCompare(a.completionDate!));

    const byDate = new Map<string, Task[]>();
    for (const t of done) {
      const date = t.completionDate!;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(t);
    }

    return [...byDate.entries()].map(([date, data]) => ({
      title: sectionHeader(date, todayStr),
      date,
      data,
    }));
  }, [tasks, todayStr]);

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.line)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length === 1 ? '1 done' : `${section.data.length} done`}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.cbDone}>
              <Text style={styles.cbX}>✕</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{cleanTitle(item.text)}</Text>
              <Text style={styles.meta}>
                {dayLabel(item.completionDate!, todayStr)}{frequencyLabel(item)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing done in the last 30 days.</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
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
  sectionCount: {
    fontSize: 10,
    color: '#444444',
    fontFamily: Fonts.mono,
  },
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
  cbDone: {
    width: 17,
    height: 17,
    backgroundColor: '#333333',
    borderWidth: 1.5,
    borderColor: '#444444',
    flexShrink: 0,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbX: {
    fontSize: 9,
    color: '#555555',
    lineHeight: 11,
  },
  content: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
    textDecorationLine: 'line-through',
    textDecorationColor: '#444444',
  },
  meta: {
    fontSize: 11,
    color: '#444444',
    letterSpacing: 0.2,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
});
