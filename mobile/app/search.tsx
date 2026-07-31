import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { TaskRow } from '../src/components/TaskRow';
import { applySearch } from '@shared/commands/search';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { usePendingDone } from '../src/hooks/usePendingDone';

export default function SearchScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const [query, setQuery] = useState('');
  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);

  const results = useMemo(
    () => (query.trim() ? applySearch(tasks, query.trim()) : []),
    [tasks, query]
  );

  async function handleDone(lineNum: number) {
    try {
      const { tasks: updated } = applyDone([...tasks], [lineNum], todayStr);
      await save(updated);
    } catch {}
  }

  async function handleDelete(lineNum: number) {
    try {
      const { tasks: updated } = applyRm([...tasks], [lineNum]);
      await save(updated);
    } catch {}
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.inputRow, { paddingTop: Spacing.sm + insets.top }]}>
        <TextInput
          style={styles.input}
          placeholder="Search tasks…"
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={t => String(t.line)}
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            todayStr={todayStr}
            pending={isPending(item.line)}
            onPress={() => router.push(`/task/${item.line}` as any)}
            onDone={() => handleDone(item.line)}
            onDelete={() => handleDelete(item.line)}
            onCheckboxPress={() => tapCheckbox(item)}
          />
        )}
        ListEmptyComponent={() =>
          query.trim() ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>no tasks matching "{query}"</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  inputRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  input: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary },
});
