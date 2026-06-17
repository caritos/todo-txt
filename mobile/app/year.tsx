import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTasks } from '../src/context/TaskContext';
import { Colors, Spacing } from '../src/theme';
import { today } from '../src/utils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function busyDot(count: number): { size: number; opacity: number } | null {
  if (count === 0) return null;
  if (count <= 2) return { size: 4, opacity: 0.45 };
  if (count <= 5) return { size: 6, opacity: 0.7 };
  return { size: 8, opacity: 1.0 };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function YearScreen() {
  const { tasks } = useTasks();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const todayStr = today();
  const todayYear = parseInt(todayStr.slice(0, 4), 10);
  const [year, setYear] = useState(todayYear);

  const scrollRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<number[]>([]);
  const todayMonthIndex = parseInt(todayStr.slice(5, 7), 10) - 1;

  const busyCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.done) continue;
      const start = t.extensions['start'];
      if (!start) continue;
      const date = start.slice(0, 10);
      map.set(date, (map.get(date) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .runOnJS(true)
    .onEnd((e) => {
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        setYear(y => y + (e.translationX < 0 ? 1 : -1));
      }
    });

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={swipe}>
      <View style={[styles.header, { paddingTop: Spacing.sm + insets.top }]}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearTitle}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(y => y + 1)} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>
      </GestureDetector>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {MONTH_NAMES.map((monthName, monthIndex) => {
          const firstDay = new Date(year, monthIndex, 1).getDay();
          const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
          const cells: (number | null)[] = [
            ...Array(firstDay).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <View
              key={monthIndex}
              onLayout={(e) => {
                monthOffsets.current[monthIndex] = e.nativeEvent.layout.y;
                if (monthIndex === todayMonthIndex && year === todayYear) {
                  scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false });
                }
              }}
            >
              <View style={styles.monthBlock}>
                <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
                <View style={styles.weekRow}>
                  {DAY_LABELS.map((d, i) => (
                    <Text key={i} style={styles.dayHdr}>{d}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((day, i) => {
                    if (day === null) {
                      return <View key={`empty-${i}`} style={styles.dayCell} />;
                    }
                    const dateStr = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
                    const isToday = dateStr === todayStr;
                    const isPast = dateStr < todayStr;
                    const count = busyCounts.get(dateStr) ?? 0;
                    const dot = busyDot(count);

                    return (
                      <TouchableOpacity
                        key={dateStr}
                        style={styles.dayCell}
                        onPress={() => router.push(`/day/${dateStr}` as any)}
                      >
                        <View style={[styles.dayNum, isToday && styles.dayNumToday]}>
                          <Text style={[
                            styles.dayNumText,
                            isPast && !isToday && styles.dayNumPast,
                            isToday && styles.dayNumTodayText,
                          ]}>
                            {day}
                          </Text>
                        </View>
                        {dot ? (
                          <View style={[
                            styles.dot,
                            { width: dot.size, height: dot.size, borderRadius: dot.size / 2, opacity: dot.opacity },
                          ]} />
                        ) : (
                          <View style={styles.dotPlaceholder} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.monthSep} />
            </View>
          );
        })}
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
  yearTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  arrow: { padding: Spacing.sm },
  arrowText: { fontSize: 22, color: Colors.textSecondary },
  scroll: { paddingBottom: 120 },
  monthBlock: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8 },
  monthTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: Colors.accent, marginBottom: 8 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayHdr: { flex: 1, textAlign: 'center', fontSize: 9, color: Colors.checkboxBorder, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 3 },
  dayNum: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dayNumToday: { backgroundColor: Colors.accent },
  dayNumText: { fontSize: 12, color: Colors.text },
  dayNumPast: { color: Colors.textDim },
  dayNumTodayText: { color: Colors.textOnAccent, fontWeight: '700' },
  dot: { backgroundColor: Colors.accent, marginTop: 2 },
  dotPlaceholder: { height: 8, marginTop: 2 },
  monthSep: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 12 },
});
