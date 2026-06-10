import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

type Props = {
  value?: string;
  onChange: (priority: string | undefined) => void;
};

export function PriorityPicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <TouchableOpacity
        style={[styles.cell, !value && styles.cellSelected]}
        onPress={() => onChange(undefined)}
      >
        <Text style={[styles.letter, !value && styles.letterSelected]}>—</Text>
      </TouchableOpacity>
      {LETTERS.map(l => (
        <TouchableOpacity
          key={l}
          style={[styles.cell, value === l && styles.cellSelected]}
          onPress={() => onChange(l)}
        >
          <Text style={[styles.letter, value === l && styles.letterSelected]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs },
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.separator,
  },
  cellSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent + '22' },
  letter: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  letterSelected: { color: Colors.accent },
});
