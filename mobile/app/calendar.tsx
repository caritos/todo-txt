import { View, Text, TouchableOpacity, SectionList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildCells(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

export default function CalendarScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  const [calYear, setCalYear] = useState(todayYear);
  const [calMonth, setCalMonth] = useState(todayMonth);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const cells = useMemo(() => buildCells(calYear, calMonth), [calYear, calMonth]);
  const rows = useMemo(() => {
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cells]);

  // Placeholder dot set — will be replaced in Task 3
  const datesWithItems = useMemo(() => new Set<string>(), []);

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .minDistance(40)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        const dir = e.translationX < 0 ? 1 : -1;
        setCalMonth(m => {
          const next = m + dir;
          if (next > 11) { setCalYear(y => y + 1); return 0; }
          if (next < 0)  { setCalYear(y => y - 1); return 11; }
          return next;
        });
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* Month calendar */}
        <View style={styles.calendarWrapper}>
          {/* Header */}
          <View style={styles.calHeader}>
            <Text style={styles.monthText}>{MONTH_NAMES[calMonth]} </Text>
            <Text style={styles.yearText}>{calYear}</Text>
          </View>
          {/* Day labels */}
          <View style={styles.dayLabelRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>
          {/* Date grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.calRow}>
              {row.map((dateStr, ci) => {
                if (!dateStr) return <View key={`e-${ri}-${ci}`} style={styles.calCell} />;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate && !isToday;
                const hasDot = datesWithItems.has(dateStr);
                const day = parseInt(dateStr.slice(8), 10);
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={styles.calCell}
                    onPress={() => setSelectedDate(dateStr)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dayNumWrap,
                      isToday && styles.dayNumWrapToday,
                      isSelected && styles.dayNumWrapSelected,
                    ]}>
                      <Text style={[
                        styles.dayNum,
                        isToday && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}>
                        {day}
                      </Text>
                    </View>
                    {hasDot
                      ? <View style={styles.dot} />
                      : <View style={styles.dotPlaceholder} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Agenda placeholder */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.textSecondary, fontFamily: Fonts.mono, fontSize: 12 }}>
            agenda coming in next task
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  calendarWrapper: {
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    paddingBottom: Spacing.xs,
  },
  calHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  monthText: { fontSize: 17, color: Colors.textSecondary, fontWeight: '300' },
  yearText: { fontSize: 17, color: Colors.accent, fontWeight: '300' },

  dayLabelRow: { flexDirection: 'row', paddingBottom: 2 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 9, color: Colors.checkboxBorder, letterSpacing: 0.5 },

  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayNumWrap: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  dayNumWrapToday: { backgroundColor: Colors.accent },
  dayNumWrapSelected: { backgroundColor: '#2D2D2D' },
  dayNum: { fontSize: 12, color: Colors.textSecondary },
  dayNumToday: { color: '#fff', fontWeight: '700' },
  dayNumSelected: { color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accent, marginTop: 1 },
  dotPlaceholder: { width: 4, height: 4, marginTop: 1 },
});
