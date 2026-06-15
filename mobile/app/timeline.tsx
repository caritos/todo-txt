import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRef, useState, useMemo, useEffect } from 'react';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL_WIDTH = Math.floor((SCREEN_WIDTH - LABEL_WIDTH) / 7);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function taskTime(task: Task): { hours: number; minutes: number } | null {
  const start = task.extensions['start'];
  if (!start || start.length <= 10) return null;
  const timePart = start.slice(11, 16);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return null;
  const [hStr, mStr] = timePart.split(':');
  return { hours: parseInt(hStr!, 10), minutes: parseInt(mStr!, 10) };
}

function topOffset(hours: number, minutes: number): number {
  return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return 'noon';
  return `${h - 12} PM`;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

export default function WeekScreen() {
  const { tasks, selectedDate, setSelectedDate } = useTasks();
  const scrollRef = useRef<ScrollView>(null);
  const todayStr = today();
  const [anchorDate, setAnchorDate] = useState(todayStr);

  const { sundayStr, weekDates } = useMemo(() => {
    const d = new Date(anchorDate + 'T12:00:00');
    const dow = d.getDay();
    const sun = new Date(d);
    sun.setDate(d.getDate() - dow);
    const s = `${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`;
    return { sundayStr: s, weekDates: Array.from({ length: 7 }, (_, i) => addDays(s, i)) };
  }, [anchorDate]);

  const weekContainsToday = weekDates.includes(todayStr);

  useEffect(() => {
    const targetHour = weekContainsToday
      ? Math.max(START_HOUR, new Date().getHours() - 2)
      : 8;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: (targetHour - START_HOUR) * HOUR_HEIGHT, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [sundayStr, weekContainsToday]);

  const { tasksPerDay, busyCounts } = useMemo(() => {
    const perDay = new Map<string, { allDay: Task[]; timed: Task[] }>();
    const counts = new Map<string, number>();
    for (const d of weekDates) perDay.set(d, { allDay: [], timed: [] });
    for (const t of tasks) {
      if (t.done) continue;
      const start = t.extensions['start'];
      if (!start) continue;
      const d = start.slice(0, 10);
      counts.set(d, (counts.get(d) ?? 0) + 1);
      const bucket = perDay.get(d);
      if (!bucket) continue;
      if (taskTime(t)) bucket.timed.push(t);
      else bucket.allDay.push(t);
    }
    for (const bucket of perDay.values()) {
      bucket.timed.sort((a, b) => {
        const ta = taskTime(a)!, tb = taskTime(b)!;
        return ta.hours * 60 + ta.minutes - (tb.hours * 60 + tb.minutes);
      });
    }
    return { tasksPerDay: perDay, busyCounts: counts };
  }, [tasks, weekDates]);

  const hasAnyAllDay = weekDates.some(d => (tasksPerDay.get(d)?.allDay.length ?? 0) > 0);
  const hasAnyTasks = weekDates.some(d => {
    const b = tasksPerDay.get(d);
    return (b?.allDay.length ?? 0) > 0 || (b?.timed.length ?? 0) > 0;
  });

  const sundayDate = new Date(sundayStr + 'T12:00:00');
  const now = new Date();
  const nowTop = weekContainsToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTop !== null && nowTop >= 0 && nowTop <= TIMELINE_HEIGHT;
  const todayColIndex = weekContainsToday ? weekDates.indexOf(todayStr) : -1;
  const selectedColIndex = weekDates.includes(selectedDate) ? weekDates.indexOf(selectedDate) : -1;
  const showSelectedCol = selectedColIndex >= 0 && selectedDate !== todayStr;

  function dotStyle(dateStr: string): { size: number; opacity: number } | null {
    const count = busyCounts.get(dateStr) ?? 0;
    if (count === 0) return null;
    if (count <= 2) return { size: 4, opacity: 0.45 };
    if (count <= 5) return { size: 6, opacity: 0.7 };
    return { size: 8, opacity: 1.0 };
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setAnchorDate(addDays(anchorDate, -7))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text>
          <Text style={styles.monthText}>{MONTHS[sundayDate.getMonth()]} </Text>
          <Text style={styles.yearText}>{sundayDate.getFullYear()}</Text>
        </Text>
        <TouchableOpacity onPress={() => setAnchorDate(addDays(anchorDate, 7))} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Week strip */}
      <View style={styles.weekStrip}>
        <View style={{ width: LABEL_WIDTH }} />
        {weekDates.map((dateStr, i) => {
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate && !isToday;
          const dot = dotStyle(dateStr);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.stripCell, { width: COL_WIDTH }, isSelected && styles.stripCellSelected]}
              onPress={() => setSelectedDate(dateStr)}
              activeOpacity={0.7}
            >
              <Text style={[styles.stripDayName, isSelected && styles.stripDayNameSelected]}>
                {DAY_NAMES[i]}
              </Text>
              <View style={[styles.stripDayBox, isToday && styles.stripDayBoxToday]}>
                <Text style={[styles.stripDayNum, isToday && styles.stripDayNumToday]}>
                  {parseInt(dateStr.slice(8), 10)}
                </Text>
              </View>
              {dot
                ? <View style={[styles.stripDot, { width: dot.size, height: dot.size, borderRadius: dot.size / 2, opacity: dot.opacity }]} />
                : <View style={styles.stripDotPlaceholder} />
              }
            </TouchableOpacity>
          );
        })}
      </View>

      {/* All-day row */}
      {hasAnyAllDay && (
        <View style={styles.allDayRow}>
          <View style={{ width: LABEL_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.allDayLabel}>ALL{'\n'}DAY</Text>
          </View>
          {weekDates.map(dateStr => {
            const allDay = tasksPerDay.get(dateStr)?.allDay ?? [];
            return (
              <View key={dateStr} style={[styles.allDayCell, { width: COL_WIDTH }]}>
                {allDay.slice(0, 2).map(t => (
                  <View key={t.line} style={styles.allDayChip}>
                    <Text style={styles.allDayChipText} numberOfLines={1}>{cleanTitle(t.text)}</Text>
                  </View>
                ))}
                {allDay.length > 2 && <Text style={styles.allDayMore}>+{allDay.length - 2}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {/* Empty state */}
      {!hasAnyTasks && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>nothing this week.</Text>
        </View>
      )}

      {/* Timeline */}
      {hasAnyTasks && (
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ height: TIMELINE_HEIGHT, position: 'relative' }}>
            {/* Time label column */}
            <View style={styles.labelCol}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
                <View key={hour} style={[styles.hourLabelCell, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}>
                  <Text style={styles.hourLabelText}>{hourLabel(hour)}</Text>
                </View>
              ))}
            </View>

            {/* Grid */}
            <View style={[styles.grid, { left: LABEL_WIDTH }]}>
              {/* Hour lines */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
                <View key={hour} style={[styles.hourLine, { top: (hour - START_HOUR) * HOUR_HEIGHT }]} />
              ))}

              {/* Selected column highlight */}
              {showSelectedCol && (
                <View style={[styles.selectedBg, { left: selectedColIndex * COL_WIDTH, width: COL_WIDTH }]} />
              )}

              {/* Today column highlight */}
              {todayColIndex >= 0 && (
                <View style={[styles.todayBg, { left: todayColIndex * COL_WIDTH, width: COL_WIDTH }]} />
              )}

              {/* Current time line */}
              {showNow && nowTop !== null && (
                <View style={[styles.nowLine, { top: nowTop }]}>
                  <View style={styles.nowDot} />
                  <View style={styles.nowBar} />
                </View>
              )}

              {/* Columns */}
              {weekDates.map((dateStr, colIndex) => {
                const timed = tasksPerDay.get(dateStr)?.timed ?? [];
                return (
                  <View key={dateStr} style={[styles.column, { left: colIndex * COL_WIDTH, width: COL_WIDTH }]}>
                    {timed.map(task => {
                      const t = taskTime(task)!;
                      const rawTop = topOffset(t.hours, t.minutes);
                      if (rawTop < 0 || rawTop > TIMELINE_HEIGHT) return null;
                      return (
                        <View key={task.line} style={[styles.pill, { top: rawTop + 1 }]}>
                          <Text style={styles.pillText} numberOfLines={1}>{cleanTitle(task.text)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  navBtn: { padding: Spacing.sm },
  navArrow: { fontSize: 22, color: Colors.textSecondary },
  monthText: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300' },
  yearText: { fontSize: 20, color: Colors.accent, fontWeight: '300' },

  weekStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  stripCell: { alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 2 },
  stripCellSelected: { backgroundColor: '#2D2D2D', borderRadius: 5 },
  stripDayName: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5 },
  stripDayNameSelected: { color: Colors.accent, fontWeight: '600' },
  stripDayBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stripDayBoxToday: { backgroundColor: Colors.accent },
  stripDayNum: { fontSize: 12, color: Colors.text },
  stripDayNumToday: { color: '#ffffff', fontWeight: '700' },
  stripDot: { backgroundColor: Colors.accent },
  stripDotPlaceholder: { height: 8 },

  allDayRow: {
    flexDirection: 'row', minHeight: 24,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: 3,
  },
  allDayLabel: { fontSize: 7, color: '#555555', letterSpacing: 0.5, textAlign: 'center' },
  allDayCell: { paddingHorizontal: 1, gap: 1 },
  allDayChip: {
    backgroundColor: Colors.accent + '22',
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingHorizontal: 2, paddingVertical: 1,
  },
  allDayChipText: { fontSize: 7, color: Colors.text, fontFamily: Fonts.mono },
  allDayMore: { fontSize: 7, color: Colors.textSecondary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },

  labelCol: { position: 'absolute', left: 0, top: 0, width: LABEL_WIDTH, height: TIMELINE_HEIGHT },
  hourLabelCell: { position: 'absolute', left: 0, width: LABEL_WIDTH, paddingLeft: Spacing.sm, paddingTop: 3 },
  hourLabelText: { fontSize: 9, color: '#444444', fontFamily: Fonts.mono },

  grid: { position: 'absolute', top: 0, right: 0, height: TIMELINE_HEIGHT },
  hourLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: '#222222',
  },
  selectedBg: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    backgroundColor: '#2D2D2D',
  },
  todayBg: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    backgroundColor: Colors.accent + '11',
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', zIndex: 10,
  },
  nowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, marginLeft: 2 },
  nowBar: { flex: 1, height: 1, backgroundColor: Colors.accent },
  column: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#222222',
  },
  pill: {
    position: 'absolute', left: 2, right: 2,
    backgroundColor: Colors.surface,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingVertical: 2, paddingHorizontal: 2,
    minHeight: 18,
  },
  pillText: { fontSize: 8, color: Colors.text, fontFamily: Fonts.mono },
});
