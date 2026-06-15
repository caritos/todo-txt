import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRef, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today, sectionHeader } from '../src/utils';
import { addDays } from '@shared/utils';
import { buildAddRaw } from '@shared/commands/add';
import { parseLine } from '@shared/parser';
import type { Task } from '@shared/parser';

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function startLabel(task: Task, todayStr: string): string | null {
  const s = task.extensions['start'];
  if (!s) return null;
  const yesterday = addDays(todayStr, -1);
  if (s === todayStr) return 'today';
  if (s === yesterday) return 'yesterday';
  const d = new Date(s + 'T12:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]!;
}

export default function TasksScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const anchorY = useRef<number>(0);
  const [draft, setDraft] = useState('');
  const todayStr = today();
  const thirtyDaysAgo = addDays(todayStr, -29);

  // Completed tasks: last 30 days, most recent first, grouped by date
  const completedSections = useMemo(() => {
    const done = tasks
      .filter(t => t.done && t.completionDate && t.completionDate >= thirtyDaysAgo && !t.extensions['type'])
      .sort((a, b) => b.completionDate!.localeCompare(a.completionDate!));
    const byDate = new Map<string, Task[]>();
    for (const t of done) {
      const d = t.completionDate!;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(t);
    }
    return [...byDate.entries()].map(([date, data]) => ({
      title: sectionHeader(date, todayStr),
      count: data.length,
      data,
    }));
  }, [tasks, todayStr]);

  // Incomplete tasks: sorted by start: date asc, no start: at bottom
  const incomplete = useMemo(() => {
    return tasks
      .filter(t => !t.done && !t.extensions['type'])
      .sort((a, b) => {
        const sa = a.extensions['start'] ?? 'zzzz';
        const sb = b.extensions['start'] ?? 'zzzz';
        return sa.localeCompare(sb);
      });
  }, [tasks]);

  const onAnchorLayout = useCallback((e: { nativeEvent: { layout: { y: number } } }) => {
    anchorY.current = e.nativeEvent.layout.y;
    scrollRef.current?.scrollTo({ y: anchorY.current, animated: false });
  }, []);

  async function submitDraft() {
    const text = draft.trim();
    if (!text) return;
    const raw = buildAddRaw(text, todayStr);
    const newTask = parseLine(raw, tasks.length + 1);
    setDraft('');
    await save([...tasks, newTask]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">

        {/* ── Zone 1: Completed tasks ── */}
        {completedSections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing done in the last 30 days.</Text>
          </View>
        ) : (
          completedSections.map(section => (
            <View key={section.title}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
                <Text style={styles.sectionCount}>
                  {section.count === 1 ? '1 done' : `${section.count} done`}
                </Text>
              </View>
              {section.data.map(task => (
                <TouchableOpacity
                  key={task.line}
                  style={styles.row}
                  onPress={() => router.push(`/task/${task.line}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cbDone}>
                    <Text style={styles.cbX}>✕</Text>
                  </View>
                  <View style={styles.content}>
                    <Text style={styles.doneTitle}>{cleanTitle(task.text)}</Text>
                    <Text style={styles.meta}>{task.completionDate}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}

        {/* ── Zone 2: Add Task anchor ── */}
        <View style={styles.anchorSeparator} />
        <View style={styles.anchorRow} onLayout={onAnchorLayout}>
          <Text style={styles.anchorPlus}>+</Text>
          <TextInput
            style={styles.anchorInput}
            placeholder="add task…"
            placeholderTextColor={Colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submitDraft}
            returnKeyType="done"
            blurOnSubmit={false}
          />
        </View>
        <View style={styles.anchorSeparator} />

        {/* ── Zone 3: Incomplete tasks ── */}
        {incomplete.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>no tasks.</Text>
          </View>
        ) : (
          incomplete.map(task => {
            const label = startLabel(task, todayStr);
            return (
              <TouchableOpacity
                key={task.line}
                style={styles.row}
                onPress={() => router.push(`/task/${task.line}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.cb} />
                <View style={styles.content}>
                  <Text style={styles.taskTitle}>{cleanTitle(task.text)}</Text>
                  {label ? <Text style={styles.meta}>{label}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  // Section headers (completed zone)
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
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
  // Shared row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  content: { flex: 1, gap: 3 },
  meta: { fontSize: 11, color: '#444444', letterSpacing: 0.2 },
  // Completed task row
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
  cbX: { fontSize: 9, color: '#555555', lineHeight: 11 },
  doneTitle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: '#555555',
    lineHeight: 19,
    textDecorationLine: 'line-through',
    textDecorationColor: '#444444',
  },
  // Incomplete task row
  cb: {
    width: 17,
    height: 17,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    flexShrink: 0,
    marginTop: 2,
  },
  taskTitle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  // Add Task anchor
  anchorSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.accent,
    marginHorizontal: Spacing.md,
    opacity: 0.4,
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  anchorPlus: {
    fontSize: 20,
    color: Colors.accent,
    lineHeight: 22,
    fontWeight: '300',
  },
  anchorInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  // Empty states
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
});
