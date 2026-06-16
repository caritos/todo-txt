import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Fonts, Spacing } from '../src/theme';
import { today } from '../src/utils';
import { addDays } from '@shared/utils';
import { nextYearlyDate, nextMonthlyDate, nextWeeklyDate } from '@shared/commands/focus';
import type { Task } from '@shared/parser';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cleanTitle(text: string): string {
  return text.replace(/(?:^|\s)[^\s:]+:[^\s/]\S*/g, '').trim();
}

function monthYearLabel(yyyyMM: string): string {
  const year = parseInt(yyyyMM.slice(0, 4), 10);
  const month = parseInt(yyyyMM.slice(5, 7), 10) - 1;
  return `${MONTH_NAMES[month]!.toUpperCase()} ${year}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

function generateOccurrences(
  task: Task,
  todayStr: string,
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
    if (startDate >= todayStr && startDate <= cutoffStr) {
      results.push({ date: startDate, task });
    }
    return results;
  }

  let cursor: string;
  if (freq === 'yearly') {
    cursor = nextYearlyDate(startDate, todayStr, exdates, freqMonthDay, every);
  } else if (freq === 'monthly') {
    cursor = nextMonthlyDate(startVal, todayStr, exdates, freqMonthDay, every);
  } else if (freq === 'weekly') {
    cursor = nextWeeklyDate(startVal, todayStr, every, exdates, freqDay);
  } else {
    return results;
  }

  while (cursor <= cutoffStr) {
    results.push({ date: cursor, task });
    if (freq === 'yearly') {
      cursor = nextYearlyDate(startDate, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else if (freq === 'monthly') {
      cursor = nextMonthlyDate(startVal, addDays(cursor, 1), exdates, freqMonthDay, every);
    } else {
      cursor = nextWeeklyDate(startVal, addDays(cursor, 1), every, exdates, freqDay);
    }
  }

  return results;
}

export default function EventsScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const cutoffStr = addDays(todayStr, 730);

  const sections = useMemo(() => {
    const events = tasks.filter(t => !t.done && !!t.extensions['type']);
    const all: Array<{ date: string; task: Task }> = [];
    for (const event of events) {
      all.push(...generateOccurrences(event, todayStr, cutoffStr));
    }
    all.sort((a, b) => a.date.localeCompare(b.date));

    const byMonth = new Map<string, Array<{ date: string; task: Task }>>();
    for (const occ of all) {
      const key = occ.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(occ);
    }

    return [...byMonth.entries()].map(([key, items]) => ({
      key,
      label: monthYearLabel(key),
      items,
    }));
  }, [tasks, todayStr, cutoffStr]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>no upcoming events.</Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.key}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.label}</Text>
              </View>
              {section.items.map((occ, i) => (
                <TouchableOpacity
                  key={`${occ.task.line}-${occ.date}-${i}`}
                  style={styles.row}
                  onPress={() => router.push(`/task/${occ.task.line}` as any)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventTitle}>{cleanTitle(occ.task.text)}</Text>
                  <Text style={styles.eventDate}>{dayLabel(occ.date)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: {},
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  sectionTitle: {
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 2,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  eventTitle: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  eventDate: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
  },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: {
    color: Colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
});
