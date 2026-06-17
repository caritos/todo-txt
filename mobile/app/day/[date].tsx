import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useMemo, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../../src/theme';
import { today } from '../../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';
import { applyFocusForWindow, focusItemOccurrence } from '@shared/commands/focus';
import { usePendingDone } from '../../src/hooks/usePendingDone';
import { parseDateParts, hourLabel, cleanTitle, formatTime } from '../../src/uiUtils';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;
const TIMELINE_RIGHT_PAD = 8;
const TIMELINE_WIDTH = Dimensions.get('window').width - LABEL_WIDTH - TIMELINE_RIGHT_PAD;

function topOffset(hours: number, minutes: number): number {
  return (hours - START_HOUR + minutes / 60) * HOUR_HEIGHT;
}

export default function DayScreen() {
  const router = useRouter();
  const { date, direction } = useLocalSearchParams<{ date: string; direction?: string }>();
  const { tasks, save, setSelectedDate } = useTasks();
  const todayStr = today();
  const scrollRef = useRef<ScrollView>(null);

  const dateStr = date ?? todayStr;
  const isToday = dateStr === todayStr;

  useEffect(() => {
    const targetHour = isToday
      ? Math.max(START_HOUR, new Date().getHours() - 2)
      : 8;
    const scrollY = (targetHour - START_HOUR) * HOUR_HEIGHT;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [dateStr, isToday]);

  useEffect(() => {
    setSelectedDate(dateStr);
  }, [dateStr]);

  const { allDay, timed } = useMemo(() => {
    const allDay: Task[] = [];
    const raw: Array<{ task: Task; time: string }> = [];
    const minWindow = addDays(todayStr, 14);
    const windowEnd = dateStr > minWindow ? dateStr : minWindow;
    const items = applyFocusForWindow(tasks, todayStr, windowEnd);
    for (const item of items) {
      const occ = focusItemOccurrence(item);
      if (occ.date !== dateStr) continue;
      if (occ.time) raw.push({ task: item.task, time: occ.time });
      else allDay.push(item.task);
    }
    allDay.sort((a, b) => {
      const pa = a.priority ?? 'ZZZ';
      const pb = b.priority ?? 'ZZZ';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.line - b.line;
    });
    raw.sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
    // Pre-compute column layout for concurrent items (same time slot → side by side)
    const slotCount = new Map<string, number>();
    for (const { time } of raw) slotCount.set(time, (slotCount.get(time) ?? 0) + 1);
    const slotCursor = new Map<string, number>();
    const timed = raw.map(({ task, time }) => {
      const total = slotCount.get(time) ?? 1;
      const col = slotCursor.get(time) ?? 0;
      slotCursor.set(time, col + 1);
      return { task, time, col, total };
    });
    return { allDay, timed };
  }, [tasks, dateStr, todayStr]);

  const now = new Date();
  const nowTopValue = isToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTopValue !== null && nowTopValue >= 0 && nowTopValue < TIMELINE_HEIGHT;

  const isEmpty = allDay.length === 0 && timed.length === 0;

  const { month, day, year, dayName } = parseDateParts(dateStr);

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX < -50) {
        const next = addDays(dateStr, 1);
        setSelectedDate(next);
        router.replace({ pathname: `/day/${next}` as any, params: { direction: 'forward' } });
      } else if (e.translationX > 50) {
        const prev = addDays(dateStr, -1);
        setSelectedDate(prev);
        router.replace({ pathname: `/day/${prev}` as any, params: { direction: 'back' } });
      }
    });

  const { isPending, tapCheckbox } = usePendingDone(tasks, todayStr, save);
  const insets = useSafeAreaInsets();

  return (
    <GestureDetector gesture={swipe}>
    <View style={styles.screen}>
      <Stack.Screen options={{ animation: direction === 'back' ? 'slide_from_left' : 'slide_from_right' }} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.dayNav}>
            <TouchableOpacity hitSlop={12} onPress={() => {
              const prev = addDays(dateStr, -1);
              setSelectedDate(prev);
              router.replace({ pathname: `/day/${prev}` as any, params: { direction: 'back' } });
            }}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity hitSlop={12} onPress={() => {
              const next = addDays(dateStr, 1);
              setSelectedDate(next);
              router.replace({ pathname: `/day/${next}` as any, params: { direction: 'forward' } });
            }}>
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateHeadline}>
            <Text style={styles.dateMonthDay}>{month} {day}, </Text>
            <Text style={styles.dateYear}>{year}</Text>
          </Text>
          <Text style={styles.dateDayName}>{dayName}</Text>
        </View>
      </View>

      {allDay.length > 0 && (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayHdr}>ALL DAY</Text>
          <ScrollView style={styles.allDayScroll} alwaysBounceVertical={false}>
            {allDay.map(task => {
              const isEvent = !!task.extensions['type'];
              return isEvent ? (
                <View key={task.line} style={styles.allDayEventRow}>
                  <Text style={styles.allDayTitle}>{cleanTitle(task.text)}</Text>
                </View>
              ) : (
                <TouchableOpacity key={task.line} style={styles.allDayRow} onPress={() => router.push(`/task/${task.line}` as any)} activeOpacity={0.7}>
                  <TouchableOpacity onPress={() => tapCheckbox(task)} hitSlop={8}>
                    {isPending(task.line) ? (
                      <View style={styles.cbPending}>
                        <Text style={styles.cbCheck}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.cb} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.allDayTitle}>{cleanTitle(task.text)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {isEmpty && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>nothing scheduled.</Text>
          </View>
        )}

        <View style={{ height: TIMELINE_HEIGHT, position: 'relative' }}>
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR).map(hour => (
            <View
              key={hour}
              style={[styles.hourLine, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}
            >
              <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
            </View>
          ))}

          {showNow && (
            <View style={[styles.nowLine, { top: nowTopValue }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}

          {timed.map(({ task, time, col, total }) => {
            const [hours, minutes] = time.split(':').map(Number);
            const rawTop = topOffset(hours, minutes);
            if (rawTop < 0 || rawTop >= TIMELINE_HEIGHT) return null;
            const colWidth = (TIMELINE_WIDTH - (total - 1) * 2) / total;
            const left = LABEL_WIDTH + col * (colWidth + 2);
            const top = rawTop + 2;
            const isEvent = !!task.extensions['type'];
            return (
              <TouchableOpacity key={task.line} style={[isEvent ? styles.pillEvent : styles.pillTask, { top, left, width: colWidth }]} onPress={() => router.push(`/task/${task.line}` as any)} activeOpacity={0.75}>
                <View style={styles.pillInner}>
                  {!isEvent && (
                    <TouchableOpacity onPress={() => tapCheckbox(task)} hitSlop={8}>
                      {isPending(task.line) ? (
                        <View style={styles.pillCbPending}>
                          <Text style={styles.pillCbCheck}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.pillCb} />
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={styles.pillText}>
                    <Text style={[styles.eventTime, isEvent && styles.eventTimeEvent]}>{formatTime(hours, minutes)}</Text>
                    <Text style={styles.eventTitle} numberOfLines={1}>{cleanTitle(task.text)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
    backgroundColor: Colors.navBar,
    paddingBottom: Spacing.md,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { minWidth: 60 },
  backText: { fontSize: 13, color: Colors.accent },
  dayNav: { flexDirection: 'row', gap: Spacing.lg, minWidth: 60, justifyContent: 'flex-end' },
  navArrow: { fontSize: 20, color: Colors.textSecondary },
  dateDisplay: { paddingHorizontal: Spacing.md, paddingTop: 2 },
  dateHeadline: { fontSize: 32, fontWeight: '300', letterSpacing: -0.5 },
  dateMonthDay: { color: Colors.text },
  dateYear: { color: Colors.accent },
  dateDayName: { fontSize: 13, color: Colors.textSecondary, letterSpacing: 1.5, marginTop: 2 },
  scroll: { paddingBottom: 120 },
  allDaySection: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  allDayScroll: { maxHeight: 132 },
  allDayHdr: {
    fontSize: 9, color: Colors.checkboxBorder, letterSpacing: 1.5,
    paddingHorizontal: Spacing.md, paddingTop: 6, paddingBottom: 4,
  },
  allDayRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator,
  },
  allDayEventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.accent + '18',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator,
  },
  cb: { width: 14, height: 14, borderWidth: 1.5, borderColor: Colors.checkboxBorder, flexShrink: 0 },
  cbPending: {
    width: 14,
    height: 14,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cbCheck: {
    fontSize: 9,
    color: Colors.text,
    lineHeight: 11,
    fontWeight: '700',
  },
  allDayTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, flex: 1 },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },
  hourLine: {
    position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.separator,
  },
  hourLabel: {
    width: LABEL_WIDTH, fontSize: 10, color: Colors.textSecondary,
    fontFamily: Fonts.mono, paddingLeft: Spacing.md, paddingTop: 3,
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', zIndex: 10,
  },
  nowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, marginLeft: 10 },
  nowBar: { flex: 1, height: 1, backgroundColor: Colors.accent },
  pillTask: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  pillEvent: {
    position: 'absolute',
    backgroundColor: Colors.accent + '22',
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillCb: { width: 10, height: 10, borderWidth: 1.5, borderColor: Colors.checkboxBorder, flexShrink: 0 },
  pillCbPending: {
    width: 10,
    height: 10,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCbCheck: {
    fontSize: 7,
    color: Colors.text,
    lineHeight: 8,
    fontWeight: '700',
  },
  pillText: { flex: 1 },
  eventTime: { fontSize: 9, color: Colors.accent, fontFamily: Fonts.mono, letterSpacing: 0.5 },
  eventTimeEvent: { color: Colors.text, opacity: 0.5 },
  eventTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
});
