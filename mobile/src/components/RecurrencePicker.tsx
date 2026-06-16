import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

export type RecurrenceValue =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

export type CustomConfig = {
  n: number;
  unit: 'day' | 'week' | 'month' | 'year';
  monthDayType?: 'date' | 'positional';
  monthDate?: number; // 1–31; 32 = Last → frequency-month-day:last-day
  positionOrdinal?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  positionWeekday?: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
};

const OPTIONS: { label: string; value: RecurrenceValue; extensions: string }[] = [
  { label: 'Never', value: 'none', extensions: '' },
  { label: 'Every Day', value: 'daily', extensions: 'frequency:daily' },
  { label: 'Every Week', value: 'weekly', extensions: 'frequency:weekly' },
  { label: 'Every 2 Weeks', value: 'biweekly', extensions: 'frequency:weekly every:2' },
  { label: 'Every Month', value: 'monthly', extensions: 'frequency:monthly' },
  { label: 'Every Year', value: 'yearly', extensions: 'frequency:yearly' },
  { label: 'Custom ›', value: 'custom', extensions: '' },
];

export function recurrenceExtensions(value: RecurrenceValue): string {
  return OPTIONS.find(o => o.value === value)?.extensions ?? '';
}

export function recurrenceLabel(value: RecurrenceValue, custom?: CustomConfig): string {
  if (value === 'custom') {
    if (!custom) return 'Custom';
    const unitParts: Record<CustomConfig['unit'], [string, string]> = {
      day: ['Day', 'Days'],
      week: ['Wk', 'Wks'],
      month: ['Mo', 'Mos'],
      year: ['Yr', 'Yrs'],
    };
    if (custom.unit === 'month') {
      if (custom.monthDayType === 'date' && custom.monthDate != null) {
        const d = custom.monthDate;
        if (d === 32) return 'Monthly · Last';
        const suffix = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
        return `Monthly · ${d}${suffix}`;
      }
      if (custom.monthDayType === 'positional' && custom.positionOrdinal && custom.positionWeekday) {
        const ords: Record<NonNullable<CustomConfig['positionOrdinal']>, string> = {
          first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'Last',
        };
        const days: Record<NonNullable<CustomConfig['positionWeekday']>, string> = {
          sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
          thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
        };
        return `Monthly · ${ords[custom.positionOrdinal]} ${days[custom.positionWeekday]}`;
      }
      if (custom.n === 1 && !custom.monthDayType) {
        return 'Every Month';
      }
    }
    const [sing, plur] = unitParts[custom.unit];
    return `Every ${custom.n} ${custom.n === 1 ? sing : plur}`;
  }
  return OPTIONS.find(o => o.value === value)?.label ?? 'Never';
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
          {opt.value === value && opt.value !== 'custom' && (
            <Text style={styles.check}>✓</Text>
          )}
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
