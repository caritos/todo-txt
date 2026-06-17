import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import type { Task } from '@shared/parser';

import { cleanTitle, buildCells } from '../src/uiUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function MonthScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const todayStr = today();
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  const insets = useSafeAreaInsets();

  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // TODO: recurring tasks appear on start: date, not next occurrence — follow-up to use applyFocusForWindow
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.done) continue;
      const start = t.extensions['start'];
      if (!start) continue;
      const date = start.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(t);
      map.set(date, list);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => buildCells(year, month), [year, month]);

  const rows = useMemo(() => {
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (e.translationX < 0) nextMonth(); else prevMonth();
      }
    });

  return (
    <GestureDetector gesture={swipe}>
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Spacing.sm + insets.top }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.arrow} hitSlop={8}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text>
          <Text style={styles.monthName}>{MONTH_NAMES[month].toUpperCase()} </Text>
          <Text style={styles.yearText}>{year}</Text>
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.arrow} hitSlop={8}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dayHeaderRow}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={styles.dayHdr}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => {
          const rowHasToday = row.some(d => d === todayStr);
          return (
          <View key={rowIndex} style={[styles.row, rowHasToday && styles.rowWithToday]}>
            {row.map((dateStr, colIndex) => {
              if (dateStr === null) {
                return <View key={`empty-${rowIndex}-${colIndex}`} style={styles.cell} />;
              }
              const isToday = dateStr === todayStr;
              const isPast = dateStr < todayStr;
              const dayTasks = tasksByDate.get(dateStr) ?? [];
              const day = parseInt(dateStr.slice(8, 10), 10);
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[styles.cell, isToday && styles.cellToday]}
                  onPress={() => router.push(`/day/${dateStr}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dateNumWrap, isToday && styles.dateNumWrapToday]}>
                    <Text style={[
                      styles.dateNum,
                      isPast && !isToday && styles.dateNumPast,
                      isToday && styles.dateNumToday,
                    ]}>
                      {day}
                    </Text>
                  </View>
                  {dayTasks.map(t => (
                    <Text key={t.line} style={styles.taskTitle} numberOfLines={1}>{cleanTitle(t.text)}</Text>
                  ))}
                </TouchableOpacity>
              );
            })}
          </View>
          );
        })}
      </View>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.navBar,
  },
  monthName: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },
  yearText: { fontSize: 17, fontWeight: '600', color: Colors.accent },
  arrow: { padding: Spacing.sm },
  arrowText: { fontSize: 22, color: Colors.textSecondary },
  dayHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.navBar,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 10, color: '#555555', letterSpacing: 0.5 },
  grid: { flex: 1 },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  rowWithToday: { zIndex: 1 },
  cell: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
    padding: 4,
    overflow: 'hidden',
  },
  cellToday: {
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: '#1f1410',
    zIndex: 1,
  },
  dateNumWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dateNumWrapToday: {
    backgroundColor: Colors.accent,
    borderRadius: 9,
  },
  dateNum: { fontSize: 11, color: Colors.text, fontFamily: Fonts.mono },
  dateNumPast: { color: '#444444' },
  dateNumToday: { color: '#ffffff', fontWeight: '700' },
  taskTitle: {
    fontSize: 8,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
    lineHeight: 11,
  },
});
