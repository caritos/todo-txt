import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Colors, Fonts, Spacing } from '../theme';
import type { CustomConfig } from './RecurrencePicker';

export function customRecurrenceExtensions(c: CustomConfig): string {
  const freqMap: Record<CustomConfig['unit'], string> = {
    day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly',
  };
  const parts: string[] = [`frequency:${freqMap[c.unit]}`];
  if (c.n > 1) parts.push(`every:${c.n}`);
  if (c.unit === 'month') {
    if (c.monthDayType === 'date' && c.monthDate) {
      parts.push(`frequency-month-day:${c.monthDate === 32 ? 'last-day' : c.monthDate}`);
    } else if (c.monthDayType === 'positional' && c.positionOrdinal && c.positionWeekday) {
      parts.push(`frequency-month-day:${c.positionOrdinal}-${c.positionWeekday}`);
    }
  }
  return parts.join(' ');
}

const MAX_N: Record<CustomConfig['unit'], number> = { day: 60, week: 52, month: 24, year: 10 };

const ORD_LABELS: Record<NonNullable<CustomConfig['positionOrdinal']>, string> = {
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', last: 'Last',
};

const DAY_LABELS: Record<NonNullable<CustomConfig['positionWeekday']>, string> = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

type Props = {
  config: CustomConfig;
  onChange: (c: CustomConfig) => void;
  onBack: () => void;
};

export function CustomRecurrencePicker({ config, onChange, onBack }: Props) {
  const [showOnDays, setShowOnDays] = useState(false);
  const [showOnWeek, setShowOnWeek] = useState(false);

  const maxN = MAX_N[config.unit];
  const nItems = Array.from({ length: maxN }, (_, i) => i + 1);

  function onUnitChange(unit: CustomConfig['unit']) {
    onChange({
      n: Math.min(config.n, MAX_N[unit]),
      unit,
      monthDayType: undefined,
      monthDate: undefined,
      positionOrdinal: undefined,
      positionWeekday: undefined,
    });
    setShowOnDays(false);
    setShowOnWeek(false);
  }

  function toggleOnDays() {
    if (!showOnDays) setShowOnWeek(false);
    setShowOnDays(v => !v);
  }

  function toggleOnWeek() {
    if (!showOnWeek) setShowOnDays(false);
    setShowOnWeek(v => !v);
  }

  const onDaysValue =
    config.monthDayType === 'date' && config.monthDate
      ? config.monthDate === 32 ? 'Last' : String(config.monthDate)
      : '—';

  const onWeekValue =
    config.monthDayType === 'positional' && config.positionOrdinal && config.positionWeekday
      ? `${ORD_LABELS[config.positionOrdinal]} ${DAY_LABELS[config.positionWeekday]}`
      : '—';

  return (
    <View style={styles.container}>
      {/* ‹ Back to presets */}
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>‹ Presets</Text>
      </TouchableOpacity>

      {/* Drum rolls: every [N] [unit] */}
      <View style={styles.drumRow}>
        <Text style={styles.everyLabel}>every</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={String(config.n)}
            onValueChange={v => onChange({ ...config, n: parseInt(v as string) })}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {nItems.map(n => (
              <Picker.Item key={n} label={String(n)} value={String(n)} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={config.unit}
            onValueChange={v => onUnitChange(v as CustomConfig['unit'])}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="day" value="day" />
            <Picker.Item label="week" value="week" />
            <Picker.Item label="month" value="month" />
            <Picker.Item label="year" value="year" />
          </Picker>
        </View>
      </View>

      {/* On Days and On Week — only when unit = month */}
      {config.unit === 'month' && (
        <>
          <TouchableOpacity style={styles.subRow} onPress={toggleOnDays}>
            <Text style={styles.subLabel}>On Days</Text>
            <View style={styles.subRight}>
              <Text style={[styles.subValue, config.monthDayType === 'date' && styles.subValueActive]}>
                {onDaysValue}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>

          {showOnDays && (
            <View style={styles.dayGrid}>
              {([...Array.from({ length: 31 }, (_, i) => i + 1), 32] as number[]).map(d => {
                const isSelected = config.monthDayType === 'date' && config.monthDate === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    onPress={() => {
                      onChange({
                        ...config,
                        monthDayType: 'date',
                        monthDate: d,
                        positionOrdinal: undefined,
                        positionWeekday: undefined,
                      });
                      setShowOnDays(false);
                    }}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                      {d === 32 ? 'Last' : String(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.subRow, !showOnWeek && styles.subRowLast]}
            onPress={toggleOnWeek}
          >
            <Text style={styles.subLabel}>On Week</Text>
            <View style={styles.subRight}>
              <Text style={[styles.subValue, config.monthDayType === 'positional' && styles.subValueActive]}>
                {onWeekValue}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>

          {showOnWeek && (
            <View style={[styles.drumRow, styles.drumRowLast]}>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.positionOrdinal ?? 'first'}
                  onValueChange={v =>
                    onChange({
                      ...config,
                      monthDayType: 'positional',
                      positionOrdinal: v as CustomConfig['positionOrdinal'],
                      monthDate: undefined,
                    })
                  }
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="first" value="first" />
                  <Picker.Item label="second" value="second" />
                  <Picker.Item label="third" value="third" />
                  <Picker.Item label="fourth" value="fourth" />
                  <Picker.Item label="last" value="last" />
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={config.positionWeekday ?? 'monday'}
                  onValueChange={v =>
                    onChange({
                      ...config,
                      monthDayType: 'positional',
                      positionWeekday: v as CustomConfig['positionWeekday'],
                      monthDate: undefined,
                    })
                  }
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Sunday" value="sunday" />
                  <Picker.Item label="Monday" value="monday" />
                  <Picker.Item label="Tuesday" value="tuesday" />
                  <Picker.Item label="Wednesday" value="wednesday" />
                  <Picker.Item label="Thursday" value="thursday" />
                  <Picker.Item label="Friday" value="friday" />
                  <Picker.Item label="Saturday" value="saturday" />
                </Picker>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  backRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  backText: {
    fontSize: 13,
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  drumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 150,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  drumRowLast: {
    borderBottomWidth: 0,
  },
  everyLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    width: 40,
    letterSpacing: 0.5,
  },
  pickerWrap: {
    flex: 1,
    height: 150,
  },
  picker: {
    flex: 1,
    color: Colors.text,
  },
  pickerItem: {
    fontSize: 16,
    color: Colors.text,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  subRowLast: {
    borderBottomWidth: 0,
  },
  subLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  subRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subValue: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  subValueActive: {
    color: Colors.accent,
  },
  chevron: {
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  dayChip: {
    width: 38,
    height: 34,
    borderWidth: 1,
    borderColor: Colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '11',
  },
  dayChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  dayChipTextActive: {
    color: Colors.accent,
  },
});
