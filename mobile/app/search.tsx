import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { TaskRow } from '../src/components/TaskRow';
import { applySearch } from '@shared/commands/search';
import { applyDone } from '@shared/commands/done';
import { applyRm } from '@shared/commands/rm';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';

export default function SearchScreen() {
  const { tasks, save } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const [query, setQuery] = useState('');

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
      <View style={styles.inputRow}>
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
            onPress={() => router.push(`/task/${item.line}` as any)}
            onDone={() => handleDone(item.line)}
            onDelete={() => handleDelete(item.line)}
          />
        )}
        ListEmptyComponent={() =>
          query.trim() ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No tasks matching "{query}"</Text>
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
