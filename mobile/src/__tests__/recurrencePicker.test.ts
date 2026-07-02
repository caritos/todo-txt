jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
}));

jest.mock('@react-native-picker/picker', () => ({
  Picker: Object.assign('Picker', { Item: 'Picker.Item' }),
}));

import { describe, test, expect } from '@jest/globals';
import { recurrenceLabel } from '../components/RecurrencePicker';
import { customRecurrenceExtensions } from '../components/CustomRecurrencePicker';

describe('recurrenceLabel', () => {
  test('shows selected weekdays for a custom weekly recurrence', () => {
    const label = recurrenceLabel('custom', { n: 1, unit: 'week', weekDays: ['M', 'W', 'F'] });
    expect(label).toBe('Weekly · M,W,F');
  });

  test('falls back to generic "Every N Wk(s)" label when no weekdays are selected', () => {
    expect(recurrenceLabel('custom', { n: 1, unit: 'week' })).toBe('Every 1 Wk');
    expect(recurrenceLabel('custom', { n: 2, unit: 'week' })).toBe('Every 2 Wks');
  });

  test('ignores an empty weekDays array the same as undefined', () => {
    expect(recurrenceLabel('custom', { n: 1, unit: 'week', weekDays: [] })).toBe('Every 1 Wk');
  });
});

describe('customRecurrenceExtensions — weekly with selected days', () => {
  test('appends frequency-day for selected weekdays', () => {
    const ext = customRecurrenceExtensions({ n: 1, unit: 'week', weekDays: ['M', 'T', 'W', 'Th', 'F'] });
    expect(ext).toBe('frequency:weekly frequency-day:M,T,W,Th,F');
  });

  test('omits frequency-day when no weekdays are selected (plain weekly, same weekday as start)', () => {
    const ext = customRecurrenceExtensions({ n: 1, unit: 'week' });
    expect(ext).toBe('frequency:weekly');
  });

  test('combines every:N with frequency-day, joining weekDays in the order given', () => {
    const ext = customRecurrenceExtensions({ n: 2, unit: 'week', weekDays: ['Sun', 'Sat'] });
    expect(ext).toBe('frequency:weekly every:2 frequency-day:Sun,Sat');
  });
});
