jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
}));

import { describe, test, expect } from '@jest/globals';
import { recurrenceLabel } from '../components/RecurrencePicker';

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
