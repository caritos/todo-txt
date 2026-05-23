import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildGridDates(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

type Props = {
  year: number;
  month: number; // 0-based
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function MonthGrid({ year, month, today, selectedDate, dotDates, onSelectDate }: Props) {
  const cells = buildGridDates(year, month);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map(d => (
          <Text key={d} style={styles.headerCell}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`e${i}`} style={styles.cell} />;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const hasDot = dotDates.has(date);
          const dayNum = parseInt(date.slice(8));
          return (
            <TouchableOpacity key={date} style={styles.cell} onPress={() => onSelectDate(date)}>
              <View style={[styles.circle, isToday && styles.todayCircle, isSelected && !isToday && styles.selectedCircle]}>
                <Text style={[styles.dayNum, isToday && styles.todayNum]}>{dayNum}</Text>
              </View>
              {hasDot && <View style={[styles.dot, isToday && styles.dotToday]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xs },
  headerRow: { flexDirection: 'row', marginBottom: 2 },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', alignItems: 'center', paddingVertical: 3 },
  circle: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: Colors.accent, borderRadius: 14 },
  selectedCircle: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: 14 },
  dayNum: { fontSize: 13, color: Colors.text },
  todayNum: { color: '#fff', fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textSecondary, marginTop: 1 },
  dotToday: { backgroundColor: '#fff' },
});
