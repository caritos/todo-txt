import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRef, useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { usePendingDone } from '../src/hooks/usePendingDone';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';
import { applyFocusForWindow, focusItemOccurrence, generateTaskOccurrences } from '@shared/commands/focus';
import { birthdayLabel } from '@shared/commands/list';

import { pad, buildCells, cleanTitle, formatMonthDayNumeric, daysUntil, daysLeftLabel } from '../src/uiUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ALL_DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Fixed row heights — must match StyleSheet values below for getItemLayout accuracy
const HEADER_H = 34;
const ROW_H = 44;

function overdueSinceLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `due ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

type AgendaItem = {
  key: string;
  task: Task;
  kind: 'completed' | 'incomplete' | 'event';
  time?: string;
  endTime?: string;
  isOverdue?: boolean;
  overdueDate?: string;
  endDate?: string;
};

type AgendaSection = {
  dateStr: string;
  title: string;
  data: AgendaItem[];
};

type FlatRow =
  | { type: 'header'; rowKey: string; dateStr: string; title: string }
  | { type: 'item'; rowKey: string; item: AgendaItem; dateStr: string };

export default function CalendarScreen() {
  const { tasks, save, weekStart, pendingDateJump, clearDateJump } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const todayMonth = parseInt(todayStr.slice(5, 7), 10) - 1;

  // Captured once at mount — pendingDateJump gets cleared shortly after
  // (see the scroll effect below), but the delayed scrollToDate call still
  // needs a stable target to read.
  const jumpTargetRef = useRef(pendingDateJump);

  const [calYear, setCalYear] = useState(() =>
    jumpTargetRef.current ? parseInt(jumpTargetRef.current.slice(0, 4), 10) : todayYear
  );
  const [calMonth, setCalMonth] = useState(() =>
    jumpTargetRef.current ? parseInt(jumpTargetRef.current.slice(5, 7), 10) - 1 : todayMonth
  );
  const [selectedDate, setSelectedDate] = useState(() => jumpTargetRef.current ?? todayStr);

  const flatListRef = useRef<FlatList<FlatRow>>(null);

  const dayLabels = useMemo(
    () => [...ALL_DAY_LABELS.slice(weekStart), ...ALL_DAY_LABELS.slice(0, weekStart)],
    [weekStart]
  );
  const cells = useMemo(() => buildCells(calYear, calMonth, weekStart), [calYear, calMonth, weekStart]);
  const rows = useMemo(() => {
    const result: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cells]);

  const { sections, dateCounts } = useMemo(() => {
    const pastCutoff = addDays(todayStr, -30);
    const futureCutoff = addDays(todayStr, 730);
    const byDate = new Map<string, AgendaItem[]>();

    function ensure(date: string) {
      if (!byDate.has(date)) byDate.set(date, []);
    }

    // 1. Past completed tasks (last 30 days), grouped by completion date
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

    // 2. Incomplete tasks: use focus logic so overdue tasks appear on today,
    // same as day/week views — otherwise tasks with past start: dates are invisible on today.
    const focusItems = applyFocusForWindow(tasks, todayStr, futureCutoff);
    for (const item of focusItems) {
      if (item.task.done || !!item.task.extensions['type']) continue;
      const occ = focusItemOccurrence(item);
      const startStr = item.task.extensions['start'] ?? '';
      const occDate = occ.date;
      const isOverdue = item.isOverdue;
      // Pin overdue tasks to today — same behaviour as day/week views
      const date = isOverdue ? todayStr : occDate;
      if (date > futureCutoff) continue;
      ensure(date);
      byDate.get(date)!.push({
        key: `task-${item.task.line}-${date}`,
        task: item.task,
        kind: 'incomplete',
        time: occ.time ?? (startStr.length > 10 ? startStr.slice(11, 16) : undefined),
        isOverdue,
        overdueDate: isOverdue ? (item.overdueDate ?? occDate) : undefined,
      });
    }

    // 3. Event occurrences: past 30 days + future 2 years
    for (const t of tasks) {
      if (!t.extensions['type'] || t.done) continue;
      const occurrences = generateTaskOccurrences(t, pastCutoff, futureCutoff);
      const startDate = t.extensions['start']?.slice(0, 10);
      const endDateVal = t.extensions['end']?.slice(0, 10);
      const endDate = endDateVal && endDateVal !== startDate ? endDateVal : undefined;
      for (const occ of occurrences) {
        ensure(occ.date);
        byDate.get(occ.date)!.push({
          key: `event-${t.line}-${occ.date}`,
          task: t,
          kind: 'event',
          time: t.extensions['start']?.slice(11, 16) || undefined,
          endTime: t.extensions['end-time'] || undefined,
          endDate,
        });
      }
    }

    const KIND_ORDER: Record<AgendaItem['kind'], number> = { incomplete: 0, event: 1, completed: 2 };
    const sortedDates = [...byDate.keys()].sort();
    const counts = new Map<string, { taskCount: number; eventCount: number }>();
    for (const [date, items] of byDate) {
      let taskCount = 0;
      let eventCount = 0;
      for (const item of items) {
        if (item.kind === 'incomplete' || item.kind === 'completed') taskCount++;
        else if (item.kind === 'event') eventCount++;
      }
      counts.set(date, { taskCount, eventCount });
    }
    const sectionList: AgendaSection[] = sortedDates.map(dateStr => {
      const d = new Date(dateStr + 'T12:00:00');
      const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
      const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
      const day = d.getDate();
      const suffix = dateStr === todayStr ? ' — TODAY' : '';
      const title = `${dow} ${mon} ${day}${suffix}`;
      // Within a kind, sort by time-of-day (untimed items — e.g. "" — sort first).
      // Event occurrences come from iterating the raw task list (generateTaskOccurrences),
      // not from applyFocusForWindow's own time-aware sort, so without this they'd keep
      // their todo.txt file order instead of chronological order.
      const data = byDate.get(dateStr)!.sort((a, b) => {
        const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
        if (kindDiff !== 0) return kindDiff;
        // Group overdue items together: their hidden start time-of-day must not interleave
        // them with same-day timed items, since the UI shows "due <date>" instead.
        const overdueDiff = Number(!!b.isOverdue) - Number(!!a.isOverdue);
        if (overdueDiff !== 0) return overdueDiff;
        if (a.isOverdue && b.isOverdue) return (a.overdueDate ?? '').localeCompare(b.overdueDate ?? '');
        return (a.time ?? '').localeCompare(b.time ?? '');
      });
      return { dateStr, title, data };
    });

    return { sections: sectionList, dateCounts: counts };
  }, [tasks, todayStr]);

  // Flatten sections into a single array for FlatList so getItemLayout can provide accurate offsets
  const { flatData, offsets, indexByDate } = useMemo(() => {
    const flatData: FlatRow[] = [];
    const offsets: number[] = [];
    const indexByDate = new Map<string, number>();
    let offset = 0;
    for (const section of sections) {
      indexByDate.set(section.dateStr, flatData.length);
      offsets.push(offset);
      flatData.push({ type: 'header', rowKey: `hdr-${section.dateStr}`, dateStr: section.dateStr, title: section.title });
      offset += HEADER_H;
      for (const item of section.data) {
        offsets.push(offset);
        flatData.push({ type: 'item', rowKey: item.key, item, dateStr: section.dateStr });
        offset += ROW_H;
      }
    }
    return { flatData, offsets, indexByDate };
  }, [sections]);

  const hasScrolledToToday = useRef(false);

  function scrollToDate(dateStr: string) {
    const idx = indexByDate.get(dateStr);
    if (idx === undefined) return;
    flatListRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0 });
  }

  useEffect(() => {
    if (flatData.length === 0 || hasScrolledToToday.current) return;
    hasScrolledToToday.current = true;
    const target = jumpTargetRef.current ?? todayStr;
    if (pendingDateJump) clearDateJump();
    const timer = setTimeout(() => scrollToDate(target), 200);
    return () => clearTimeout(timer);
  }, [flatData]);

  useEffect(() => {
    const monthPrefix = `${calYear}-${pad(calMonth + 1)}`;
    const target = sections.find(s => s.dateStr.startsWith(monthPrefix))
      ?? sections.find(s => s.dateStr >= `${calYear}-${pad(calMonth + 1)}-01`);
    if (!target) return;
    const timer = setTimeout(() => scrollToDate(target.dateStr), 50);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calYear, calMonth]);

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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <GestureDetector gesture={swipe}>
        {/* Month calendar */}
        <View style={styles.calendarWrapper}>
          {/* Header */}
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => setCalMonth(m => { const n = m - 1; if (n < 0) { setCalYear(y => y - 1); return 11; } return n; })} style={styles.arrow} hitSlop={8}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthText}>{MONTH_NAMES[calMonth]} <Text style={styles.yearText}>{calYear}</Text></Text>
            <TouchableOpacity onPress={() => setCalMonth(m => { const n = m + 1; if (n > 11) { setCalYear(y => y + 1); return 0; } return n; })} style={styles.arrow} hitSlop={8}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          </View>
          {/* Day labels */}
          <View style={styles.dayLabelRow}>
            {dayLabels.map(d => (
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
                const counts = dateCounts.get(dateStr);
                const taskDots = Math.min(counts?.taskCount ?? 0, 3);
                const eventDots = Math.min(counts?.eventCount ?? 0, 3);
                const day = parseInt(dateStr.slice(8), 10);
                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={styles.calCell}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      scrollToDate(dateStr);
                    }}
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
                    {(taskDots > 0 || eventDots > 0)
                      ? (
                        <View style={styles.dotRow}>
                          {Array.from({ length: taskDots }).map((_, i) => (
                            <View key={`t-${i}`} style={[styles.dot, styles.dotTask]} />
                          ))}
                          {Array.from({ length: eventDots }).map((_, i) => (
                            <View key={`e-${i}`} style={[styles.dot, styles.dotEvent]} />
                          ))}
                        </View>
                      )
                      : <View style={styles.dotPlaceholder} />
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>

      <FlatList<FlatRow>
        ref={flatListRef}
        data={flatData}
        keyExtractor={row => row.rowKey}
        initialScrollIndex={indexByDate.get(todayStr)}
        getItemLayout={(_, index) => ({
          length: flatData[index]?.type === 'header' ? HEADER_H : ROW_H,
          offset: offsets[index] ?? 0,
          index,
        })}
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <View style={[
                styles.sectionHeader,
                row.dateStr === todayStr && styles.sectionHeaderToday,
              ]}>
                <Text style={[
                  styles.sectionTitle,
                  row.dateStr === todayStr && styles.sectionTitleToday,
                ]}>
                  {row.title}
                </Text>
              </View>
            );
          }
          const { item, dateStr } = row;
          const pending = item.kind === 'incomplete' && isPending(item.task.raw);
          return (
            <TouchableOpacity
              style={[
                styles.agendaRow,
                dateStr === todayStr && styles.agendaRowToday,
              ]}
              onPress={() => router.push(`/task/${item.task.line}` as any)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                onPress={() => (item.kind === 'incomplete' || item.kind === 'completed') && tapCheckbox(item.task)}
                hitSlop={8}
                style={styles.agendaIconBtn}
              >
                <Text style={[
                  styles.agendaIcon,
                  item.kind === 'event' && styles.agendaIconEvent,
                  (item.kind === 'completed' || pending) && styles.agendaIconDone,
                  item.kind === 'incomplete' && item.isOverdue && !pending && styles.agendaIconOverdue,
                ]}>
                  {item.kind === 'completed' || pending ? '✓' : item.kind === 'event' ? '◆' : '□'}
                </Text>
              </TouchableOpacity>
              <Text
                style={[styles.agendaTitle, (item.kind === 'completed' || pending) && styles.agendaTitleDone]}
                numberOfLines={1}
              >
                {birthdayLabel(item.task, todayStr) + cleanTitle(item.task.text)}
              </Text>
              {item.overdueDate ? (
                <Text style={styles.agendaOverdue}>{overdueSinceLabel(item.overdueDate)}</Text>
              ) : item.time ? (
                <Text style={styles.agendaTime}>
                  {item.time}{item.endTime ? ` - ${item.endTime}` : ''}
                  {item.endDate ? ` · ${daysLeftLabel(daysUntil(dateStr, item.endDate))}` : ''}
                </Text>
              ) : item.endDate ? (
                <Text style={styles.agendaTime}>{formatMonthDayNumeric(item.endDate)} · {daysLeftLabel(daysUntil(dateStr, item.endDate))}</Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
        onScrollToIndexFailed={({ index }) => {
          // Fallback: jump to computed offset directly (getItemLayout should prevent this)
          flatListRef.current?.scrollToOffset({ offset: offsets[index] ?? 0, animated: false });
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  arrow: { padding: Spacing.sm },
  arrowText: { fontSize: 22, color: Colors.textSecondary },
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
  dayNumWrapSelected: { backgroundColor: Colors.surfaceSelected },
  dayNum: { fontSize: 12, color: Colors.textSecondary },
  dayNumToday: { color: Colors.text, fontWeight: '700' },
  dayNumSelected: { color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotTask: { backgroundColor: Colors.accent },
  dotEvent: { backgroundColor: Colors.eventDot },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 1, height: 4 },
  dotPlaceholder: { width: 4, height: 4, marginTop: 1 },

  // Section header — height must match HEADER_H constant
  sectionHeader: {
    height: HEADER_H,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  sectionHeaderToday: {
    backgroundColor: Colors.accent + '11',
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
    fontFamily: Fonts.mono,
  },
  sectionTitleToday: {
    color: Colors.accent,
    fontWeight: '700',
  },
  // Agenda row — height must match ROW_H constant
  agendaRow: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    gap: Spacing.sm,
  },
  agendaRowToday: {
    backgroundColor: Colors.accent + '08',
  },
  agendaIconBtn: { paddingRight: Spacing.sm },
  agendaIcon: { fontSize: 11, color: Colors.textSecondary, width: 14, textAlign: 'center' },
  agendaIconEvent: { color: Colors.accent },
  agendaIconDone: { color: Colors.textSecondary },
  agendaIconOverdue: { color: Colors.accent },
  agendaTitle: { flex: 1, fontSize: 13, color: Colors.text, fontFamily: Fonts.mono },
  agendaTitleDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  agendaTime: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.mono },
  agendaOverdue: { fontSize: 11, color: Colors.accent, fontFamily: Fonts.mono },
});
