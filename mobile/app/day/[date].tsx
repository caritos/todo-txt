import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useEffect } from 'react';
import { useTasks } from '../../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../../src/theme';
import { today } from '../../src/utils';
import { addDays } from '@shared/utils';
import type { Task } from '@shared/parser';

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const LABEL_WIDTH = 52;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const m = d.getMonth() + 1;
  return `${DAY_NAMES[d.getDay()]!.toUpperCase()}  ${m}/${d.getDate()}`;
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
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

function formatTime(hours: number, minutes: number): string {
  const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export default function DayScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { tasks } = useTasks();
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

  const { allDay, timed } = useMemo(() => {
    const dayTasks = tasks.filter(t => {
      const start = t.extensions['start'];
      return start && start.slice(0, 10) === dateStr;
    });
    const allDay: Task[] = [];
    const timed: Task[] = [];
    for (const t of dayTasks) {
      if (taskTime(t)) timed.push(t);
      else allDay.push(t);
    }
    allDay.sort((a, b) => {
      const pa = a.priority ?? 'ZZZ';
      const pb = b.priority ?? 'ZZZ';
      if (pa !== pb) return pa.localeCompare(pb);
      return a.line - b.line;
    });
    timed.sort((a, b) => {
      const ta = taskTime(a)!;
      const tb = taskTime(b)!;
      return ta.hours * 60 + ta.minutes - (tb.hours * 60 + tb.minutes);
    });
    return { allDay, timed };
  }, [tasks, dateStr]);

  const now = new Date();
  const nowTopValue = isToday ? topOffset(now.getHours(), now.getMinutes()) : null;
  const showNow = nowTopValue !== null && nowTopValue >= 0 && nowTopValue <= TIMELINE_HEIGHT;

  const isEmpty = allDay.length === 0 && timed.length === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Year</Text>
        </TouchableOpacity>
        <Text style={styles.dayTitle}>{formatDayHeader(dateStr)}</Text>
        <View style={styles.dayNav}>
          <TouchableOpacity onPress={() => router.replace(`/day/${addDays(dateStr, -1)}` as any)}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace(`/day/${addDays(dateStr, 1)}` as any)}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {allDay.length > 0 && (
          <View style={styles.allDaySection}>
            <Text style={styles.allDayHdr}>ALL DAY</Text>
            {allDay.map(task => (
              <View key={task.line} style={styles.allDayRow}>
                <View style={styles.cb} />
                <Text style={styles.allDayTitle}>{cleanTitle(task.text)}</Text>
              </View>
            ))}
          </View>
        )}

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

          {timed.map(task => {
            const t = taskTime(task)!;
            const rawTop = topOffset(t.hours, t.minutes);
            if (rawTop < 0 || rawTop > TIMELINE_HEIGHT) return null;
            const top = rawTop + 2;
            return (
              <View key={task.line} style={[styles.eventPill, { top, left: LABEL_WIDTH, right: 8 }]}>
                <Text style={styles.eventTime}>{formatTime(t.hours, t.minutes)}</Text>
                <Text style={styles.eventTitle} numberOfLines={1}>{cleanTitle(task.text)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
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
  backBtn: { minWidth: 60 },
  backText: { fontSize: 13, color: Colors.accent },
  dayTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, letterSpacing: 1 },
  dayNav: { flexDirection: 'row', gap: Spacing.lg, minWidth: 60, justifyContent: 'flex-end' },
  navArrow: { fontSize: 20, color: Colors.textSecondary },
  scroll: { paddingBottom: 120 },
  allDaySection: { borderBottomWidth: 1, borderBottomColor: Colors.separator },
  allDayHdr: {
    fontSize: 9, color: '#555555', letterSpacing: 1.5,
    paddingHorizontal: Spacing.md, paddingTop: 6, paddingBottom: 4,
  },
  allDayRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222222',
  },
  cb: { width: 14, height: 14, borderWidth: 1.5, borderColor: Colors.checkboxBorder, flexShrink: 0 },
  allDayTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, flex: 1 },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, fontStyle: 'italic', fontFamily: Fonts.mono, fontSize: 13 },
  hourLine: {
    position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222222',
  },
  hourLabel: {
    width: LABEL_WIDTH, fontSize: 10, color: '#444444',
    fontFamily: Fonts.mono, paddingLeft: Spacing.md, paddingTop: 4,
  },
  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', zIndex: 10,
  },
  nowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent, marginLeft: 10 },
  nowBar: { flex: 1, height: 1, backgroundColor: Colors.accent },
  eventPill: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderLeftWidth: 2, borderLeftColor: Colors.accent,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
  },
  eventTime: { fontSize: 9, color: Colors.accent, fontFamily: Fonts.mono, letterSpacing: 0.5 },
  eventTitle: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
});
