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
import { nextYearlyDate, nextMonthlyDate, nextWeeklyDate } from '@shared/commands/focus';

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

function generateOccurrences(
  task: Task,
  fromStr: string,
  cutoffStr: string,
): Array<{ date: string; task: Task }> {
  const startVal = task.extensions['start'];
  if (!startVal) return [];
  const startDate = startVal.slice(0, 10);
  const freq = task.extensions['frequency'];
  const every = parseInt(task.extensions['every'] ?? '1', 10);
  const exdates = new Set((task.extensions['exdate'] ?? '').split(',').filter(Boolean));
  const freqDay = task.extensions['frequency-day'];
  const freqMonthDay = task.extensions['frequency-month-day'];
  const results: Array<{ date: string; task: Task }> = [];

  if (!freq) {
    if (startDate >= fromStr && startDate <= cutoffStr) {
      results.push({ date: startDate, task });
    }
    return results;
  }

  let cursor: string;
  if (freq === 'yearly') {
    cursor = nextYearlyDate(startDate, fromStr, exdates, freqMonthDay, every);
  } else if (freq === 'monthly') {
    cursor = nextMonthlyDate(startVal, fromStr, exdates, freqMonthDay, every);
  } else if (freq === 'weekly') {
    cursor = nextWeeklyDate(startVal, fromStr, every, exdates, freqDay);
  } else {
    // daily and other frequencies not supported — same as events.tsx
    return results;
  }

  while (cursor <= cutoffStr) {
    results.push({ date: cursor, task });
    let next: string;
    if (freq === 'yearly') {
      next = nextYearlyDate(startDate, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else if (freq === 'monthly') {
      next = nextMonthlyDate(startVal, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else {
      next = nextWeeklyDate(startVal, addDays(cursor, 1), every, exdates, freqDay);
    }
    if (next <= cursor) break;
    cursor = next;
  }

  return results;
}

type AgendaItem = {
  key: string;
  task: Task;
  kind: 'completed' | 'incomplete' | 'event';
  time?: string;
};

type AgendaSection = {
  dateStr: string;
  title: string;
  data: AgendaItem[];
};

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

  const { sections, datesWithItems } = useMemo(() => {
    const pastCutoff = addDays(todayStr, -90);
    const futureCutoff = addDays(todayStr, 730);
    const byDate = new Map<string, AgendaItem[]>();

    function ensure(date: string) {
      if (!byDate.has(date)) byDate.set(date, []);
    }

    // 1. Past completed tasks (last 90 days), grouped by completion date
    for (const t of tasks) {
      if (!t.done || !t.completionDate) continue;
      const date = t.completionDate.slice(0, 10);
      if (date < pastCutoff || date > todayStr) continue;
      ensure(date);
      byDate.get(date)!.push({
        key: `done-${t.line}-${date}`,
        task: t,
        kind: 'completed',
        time: t.extensions['start']?.slice(11, 16) || undefined,
      });
    }

    // 2. Incomplete tasks grouped by start: date
    // Incomplete tasks: show on their start: date regardless of recurrence state —
    // calendar view shows scheduled dates, not a focus/overdue filter.
    for (const t of tasks) {
      if (t.done || !!t.extensions['type']) continue;
      const startVal = t.extensions['start'];
      if (!startVal) continue;
      const date = startVal.slice(0, 10);
      if (date < pastCutoff || date > futureCutoff) continue;
      ensure(date);
      byDate.get(date)!.push({
        key: `task-${t.line}-${date}`,
        task: t,
        kind: 'incomplete',
        time: startVal.length > 10 ? startVal.slice(11, 16) : undefined,
      });
    }

    // 3. Event occurrences: past 90 days + future 2 years
    for (const t of tasks) {
      if (!t.extensions['type']) continue;
      const occurrences = generateOccurrences(t, pastCutoff, futureCutoff);
      for (const occ of occurrences) {
        ensure(occ.date);
        byDate.get(occ.date)!.push({
          key: `event-${t.line}-${occ.date}`,
          task: t,
          kind: 'event',
          time: t.extensions['start']?.slice(11, 16) || undefined,
        });
      }
    }

    // Sort by date and build sections
    const sortedDates = [...byDate.keys()].sort();
    const dotSet = new Set(sortedDates);
    const sectionList: AgendaSection[] = sortedDates.map(dateStr => {
      const d = new Date(dateStr + 'T12:00:00');
      const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
      const day = d.getDate();
      const suffix = dateStr === todayStr ? ' — TODAY' : '';
      const title = `${dow} ${mon} ${day}${suffix}`;
      return { dateStr, title, data: byDate.get(dateStr)! };
    });

    return { sections: sectionList, datesWithItems: dotSet };
  }, [tasks, todayStr]);

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
