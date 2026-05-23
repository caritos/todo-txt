import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useState } from 'react';
import { WeekStrip } from './WeekStrip';
import { MonthGrid } from './MonthGrid';
import { Colors, Spacing } from '../theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_GRID_HEIGHT = 230;

type Props = {
  today: string;
  selectedDate: string;
  dotDates: Set<string>;
  onSelectDate: (date: string) => void;
};

export function CalendarHeader({ today, selectedDate, dotDates, onSelectDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const gridHeight = useSharedValue(0);

  const year = parseInt(today.slice(0, 4));
  const month = parseInt(today.slice(5, 7)) - 1; // convert to 0-based

  const animatedStyle = useAnimatedStyle(() => ({
    height: withSpring(gridHeight.value, { damping: 22, stiffness: 220 }),
    overflow: 'hidden',
  }));

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    gridHeight.value = next ? MONTH_GRID_HEIGHT : 0;
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthRow}>
        <Text>
          <Text style={styles.monthName}>{MONTH_NAMES[month]} </Text>
          <Text style={styles.year}>{year}</Text>
        </Text>
      </View>
      <WeekStrip
        today={today}
        selectedDate={selectedDate}
        dotDates={dotDates}
        onSelectDate={onSelectDate}
      />
      <Animated.View style={animatedStyle}>
        <MonthGrid
          year={year}
          month={month}
          today={today}
          selectedDate={selectedDate}
          dotDates={dotDates}
          onSelectDate={onSelectDate}
        />
      </Animated.View>
      <TouchableOpacity onPress={toggle} style={styles.handleRow} hitSlop={10}>
        <View style={[styles.handle, expanded && styles.handleExpanded]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.navBar,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  monthRow: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 0 },
  monthName: { fontSize: 22, color: Colors.textSecondary, fontWeight: '300', letterSpacing: -0.3 },
  year: { fontSize: 22, color: Colors.accent, fontWeight: '300', letterSpacing: -0.3 },
  handleRow: { alignItems: 'center', paddingVertical: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.separator },
  handleExpanded: { backgroundColor: Colors.accent },
});
