import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export type RecurrenceValue =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly';

const OPTIONS: { label: string; value: RecurrenceValue; extensions: string }[] = [
  { label: 'Never', value: 'none', extensions: '' },
  { label: 'Every Day', value: 'daily', extensions: 'frequency:daily' },
  { label: 'Every Week', value: 'weekly', extensions: 'frequency:weekly' },
  { label: 'Every 2 Weeks', value: 'biweekly', extensions: 'frequency:weekly every:2' },
  { label: 'Every Month', value: 'monthly', extensions: 'frequency:monthly' },
  { label: 'Every Year', value: 'yearly', extensions: 'frequency:yearly' },
];

export function recurrenceExtensions(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.extensions ?? '';
}

type Props = {
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
};

export function RecurrencePicker({ value, onChange }: Props) {
  return (
    <View>
      {OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, opt.value === value && styles.optionSelected]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, opt.value === value && styles.optionTextSelected]}>
            {opt.label}
          </Text>
          {opt.value === value && <Text style={styles.check}>✓</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  optionSelected: { backgroundColor: Colors.accent + '11' },
  optionText: { fontSize: 16, color: Colors.text },
  optionTextSelected: { color: Colors.accent },
  check: { color: Colors.accent, fontSize: 16 },
});
