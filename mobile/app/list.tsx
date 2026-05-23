import { View, Text, FlatList, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { TaskRow } from '../src/components/TaskRow';
import { StatsCard } from '../src/components/StatsCard';
import { AddTaskModal } from '../src/components/AddTaskModal';
import { sortByPriority } from '@shared/commands/list';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Spacing } from '../src/theme';
import { today, formatDateLabel } from '../src/utils';
import * as Haptics from 'expo-haptics';

export default function ListScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();

  const [showAll, setShowAll] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const openTasks = useMemo(
    () => sortByPriority(showAll ? tasks : tasks.filter(t => !t.done)),
    [tasks, showAll]
  );

  const projectCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of openTasks) {
      for (const p of t.projects) map.set(p, (map.get(p) ?? 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [openTasks]);

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

  const ListHeader = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        <StatsCard label="Open" count={openTasks.length} />
        {projectCounts.map(([proj, count]) => (
          <StatsCard key={proj} label={proj} count={count} />
        ))}
      </ScrollView>
      <View style={styles.separator} />
      <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add Task</Text>
      </TouchableOpacity>
      <View style={styles.separator} />
      <TouchableOpacity onPress={() => setShowAll(s => !s)} style={styles.allToggle}>
        <Text style={styles.allToggleText}>{showAll ? 'Show open only' : 'Show all (including done)'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={openTasks}
        keyExtractor={t => String(t.line)}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            dateLabel={item.extensions['start'] ? formatDateLabel(item.extensions['start']!) : undefined}
            isOverdue={
              item.extensions['due'] !== undefined && item.extensions['due']! < todayStr
            }
            onPress={() => router.push(`/task/${item.line}` as any)}
            onDone={() => handleDone(item.line)}
            onDelete={() => handleDelete(item.line)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No open tasks.</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
      <AddTaskModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  cards: { flexDirection: 'row', gap: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.separator },
  addButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  addButtonText: { fontSize: 15, color: Colors.accent },
  allToggle: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  allToggleText: { fontSize: 13, color: Colors.accent },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic' },
});
