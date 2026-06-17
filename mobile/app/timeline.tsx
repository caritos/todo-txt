import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import { taskOccurrence, applyFocusForWindow, focusItemOccurrence } from '@shared/commands/focus';
import type { Task } from '@shared/parser';
import { pad, hourLabel, cleanTitle } from '../src/uiUtils';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COL_WIDTH = Math.floor((SCREEN_WIDTH - LABEL_WIDTH) / 7);

// All-day section: sized to show exactly 4 chip rows before scrolling.
// Chip: fontSize:7 (~10px) + paddingVertical:1*2 = 12px. Gap between chips: 1px.
// Container paddingVertical:3 adds 6px.
const ALLDAY_CHIP_H = 12;
const ALLDAY_CHIP_GAP = 1;
const ALLDAY_ROWS = 4;
const ALLDAY_MAX_H = ALLDAY_ROWS * ALLDAY_CHIP_H + (ALLDAY_ROWS - 1) * ALLDAY_CHIP_GAP + 6;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function topOffset(hours: number, minutes: number): number {
  return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
}

export default function WeekScreen() {
  const { tasks, selectedDate, setSelectedDate } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    type TimedItem = { task: Task; col: number; total: number };
    const rawPerDay = new Map<string, { allDay: Task[]; timedRaw: Array<{ task: Task; time: string }> }>();
    const counts = new Map<string, number>();
    for (const d of weekDates) rawPerDay.set(d, { allDay: [], timedRaw: [] });
    const lastDay = weekDates[weekDates.length - 1];
    const minWindow = addDays(todayStr, 14);
    const windowEnd = lastDay > minWindow ? lastDay : minWindow;
    const items = applyFocusForWindow(tasks, todayStr, windowEnd);
    for (const item of items) {
      const occ = focusItemOccurrence(item);
      const bucket = rawPerDay.get(occ.date);
      if (!bucket) continue;
      counts.set(occ.date, (counts.get(occ.date) ?? 0) + 1);
      if (occ.time) bucket.timedRaw.push({ task: item.task, time: occ.time });
      else bucket.allDay.push(item.task);
    }
    const perDay = new Map<string, { allDay: Task[]; timed: TimedItem[] }>();
    for (const [d, bucket] of rawPerDay.entries()) {
      bucket.timedRaw.sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return ah * 60 + am - (bh * 60 + bm);
      });
      const slotCount = new Map<string, number>();
      for (const { time } of bucket.timedRaw) slotCount.set(time, (slotCount.get(time) ?? 0) + 1);
      const slotCursor = new Map<string, number>();
      perDay.set(d, {
        allDay: bucket.allDay,
        timed: bucket.timedRaw.map(({ task, time }) => {
          const total = slotCount.get(time) ?? 1;
          const col = slotCursor.get(time) ?? 0;
          slotCursor.set(time, col + 1);
          return { task, col, total };
        }),
      });
    }
    return { tasksPerDay: perDay, busyCounts: counts };
  }, [tasks, weekDates, todayStr]);

  const hasAnyAllDay = weekDates.some(d => (tasksPerDay.get(d)?.allDay.length ?? 0) > 0);
  const hasAnyTasks = weekDates.some(d => {
    const b = tasksPerDay.get(d);
    return (b?.allDay.length ?? 0) > 0 || (b?.timed.length ?? 0) > 0;
  });

  const sundayDate = new Date(sundayStr + 'T12:00:00');
  const now = new Date();
  const nowTop = weekContainsToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTop !== null && nowTop >= 0 && nowTop < TIMELINE_HEIGHT;
  const todayColIndex = weekContainsToday ? weekDates.indexOf(todayStr) : -1;
  const selectedColIndex = weekDates.findIndex(d => d === selectedDate);
  const showSelectedCol = selectedColIndex >= 0 && selectedDate !== todayStr;

  function dotStyle(dateStr: string): { size: number; opacity: number } | null {
    const count = busyCounts.get(dateStr) ?? 0;
    if (count === 0) return null;
    if (count <= 2) return { size: 4, opacity: 0.45 };
    if (count <= 5) return { size: 6, opacity: 0.7 };
    return { size: 8, opacity: 1.0 };
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        setAnchorDate(prev => addDays(prev, e.translationX < 0 ? 7 : -7));
      }
    });

  return (
    <GestureDetector gesture={swipe}>
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Spacing.sm + insets.top }]}>
        <TouchableOpacity onPress={() => setAnchorDate(prev => addDays(prev, -7))} style={styles.arrow} hitSlop={8}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text>
          <Text style={styles.monthText}>{MONTHS[sundayDate.getMonth()]} </Text>
          <Text style={styles.yearText}>{sundayDate.getFullYear()}</Text>
        </Text>
        <TouchableOpacity onPress={() => setAnchorDate(prev => addDays(prev, 7))} style={styles.arrow} hitSlop={8}>
          <Text style={styles.arrowText}>›</Text>
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
              onPress={() => router.push(`/day/${dateStr}` as any)}
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
          <View style={styles.allDayLabelCol}>
            <Text style={styles.allDayLabel}>ALL{'\n'}DAY</Text>
          </View>
          <ScrollView style={styles.allDayScroll} alwaysBounceVertical={false}>
            <View style={styles.allDayCols}>
              {weekDates.map(dateStr => {
                const allDay = tasksPerDay.get(dateStr)?.allDay ?? [];
                return (
                  <View key={dateStr} style={[styles.allDayCell, { width: COL_WIDTH }]}>
                    {allDay.map(t => {
                      const isEvent = !!t.extensions['type'];
                      return (
                        <View key={t.line} style={isEvent ? styles.allDayEventChip : styles.allDayChip}>
                          <Text style={styles.allDayChipText}>{cleanTitle(t.text)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
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
                    {timed.map(({ task, col, total }) => {
                      const occ = taskOccurrence(task, todayStr);
                      if (!occ?.time) return null;
                      const [hours, minutes] = occ.time.split(':').map(Number);
                      const rawTop = topOffset(hours, minutes);
                      if (rawTop < 0 || rawTop >= TIMELINE_HEIGHT) return null;
                      const isEvent = !!task.extensions['type'];
                      const innerWidth = COL_WIDTH - 4;
                      const pillWidth = total === 1 ? innerWidth : Math.floor((innerWidth - (total - 1)) / total);
                      const pillLeft = 2 + col * (pillWidth + 1);
                      return (
                        <View key={task.line} style={[isEvent ? styles.pillEvent : styles.pill, { top: rawTop + 1, left: pillLeft, width: pillWidth }]}>
                          <Text style={styles.pillText}>{cleanTitle(task.text)}</Text>
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
    </GestureDetector>
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
  arrow: { padding: Spacing.sm },
  arrowText: { fontSize: 22, color: Colors.textSecondary },
  monthText: { fontSize: 20, color: Colors.textSecondary, fontWeight: '300' },
  yearText: { fontSize: 20, color: Colors.accent, fontWeight: '300' },

  weekStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.navBar,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  stripCell: { alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 2 },
  stripCellSelected: { backgroundColor: Colors.surfaceSelected, borderRadius: 5 },
  stripDayName: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.5 },
  stripDayNameSelected: { color: Colors.accent, fontWeight: '600' },
  stripDayBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  stripDayBoxToday: { backgroundColor: Colors.accent },
  stripDayNum: { fontSize: 12, color: Colors.text },
  stripDayNumToday: { color: Colors.textOnAccent, fontWeight: '700' },
  stripDot: { backgroundColor: Colors.accent },
  stripDotPlaceholder: { height: 8 },

  allDayRow: {
    flexDirection: 'row',
    maxHeight: ALLDAY_MAX_H,
    borderBottomWidth: 1, borderBottomColor: Colors.separator,
  },
  allDayLabelCol: { width: LABEL_WIDTH, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  allDayScroll: { flex: 1 },
  allDayCols: { flexDirection: 'row', paddingVertical: 3 },
  allDayLabel: { fontSize: 7, color: Colors.checkboxBorder, letterSpacing: 0.5, textAlign: 'center' },
  allDayCell: { paddingHorizontal: 1, gap: 1 },
  allDayChip: {
    backgroundColor: Colors.accent + '22',
    paddingHorizontal: 2, paddingVertical: 1,
  },
  allDayEventChip: {
    backgroundColor: Colors.accent + '40',
    paddingHorizontal: 2, paddingVertical: 1,
  },
  allDayChipText: { fontSize: 7, color: Colors.text, fontFamily: Fonts.mono },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },

  labelCol: { position: 'absolute', left: 0, top: 0, width: LABEL_WIDTH, height: TIMELINE_HEIGHT },
  hourLabelCell: { position: 'absolute', left: 0, width: LABEL_WIDTH, paddingLeft: Spacing.sm, paddingTop: 3 },
  hourLabelText: { fontSize: 9, color: Colors.textDim, fontFamily: Fonts.mono },

  grid: { position: 'absolute', top: 0, right: 0, height: TIMELINE_HEIGHT },
  hourLine: {
    position: 'absolute', left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.divider,
  },
  selectedBg: {
    position: 'absolute', top: 0, height: TIMELINE_HEIGHT,
    backgroundColor: Colors.surfaceSelected,
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
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Colors.divider,
  },
  pill: {
    position: 'absolute',
    backgroundColor: Colors.accent + '22',
    paddingVertical: 2, paddingHorizontal: 2,
    minHeight: 18,
  },
  pillEvent: {
    position: 'absolute',
    backgroundColor: Colors.accent + '40',
    paddingVertical: 2, paddingHorizontal: 2,
    minHeight: 18,
  },
  pillText: { fontSize: 8, color: Colors.text, fontFamily: Fonts.mono },
});
