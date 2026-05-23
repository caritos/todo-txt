import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function weekDates(anchorDate: string): string[] {
  const d = new Date(anchorDate + 'T12:00:00');
  const dow = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  });
}

type Props = {
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function WeekStrip({ today, selectedDate, dotDates, onSelectDate }: Props) {
  const dates = weekDates(today);

  return (
    <View style={styles.strip}>
      {dates.map(date => {
        const isToday = date === today;
        const isSelected = date === selectedDate;
        const hasDot = dotDates.has(date);
        const dayNum = parseInt(date.slice(8));
        const dow = new Date(date + 'T12:00:00').getDay();

        return (
          <TouchableOpacity key={date} style={styles.col} onPress={() => onSelectDate(date)}>
            <Text style={styles.dayLabel}>{DAY_LABELS[dow]}</Text>
            <View style={[styles.circle, isToday && styles.todayCircle, isSelected && !isToday && styles.selectedCircle]}>
              <Text style={[styles.dayNum, isToday && styles.todayNum]}>{dayNum}</Text>
            </View>
            <View style={[styles.dot, hasDot && styles.dotVisible, isToday && hasDot && styles.dotToday]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  dayLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  circle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: Colors.accent, borderRadius: 16 },
  selectedCircle: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: 16 },
  dayNum: { fontSize: 15, color: Colors.text, fontWeight: '400' },
  todayNum: { color: '#fff', fontWeight: '700' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotVisible: { backgroundColor: Colors.textSecondary },
  dotToday: { backgroundColor: '#fff' },
});
