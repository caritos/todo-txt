import { View, Text } from 'react-native';
import { Colors } from '../src/theme';

export default function CalendarScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.textSecondary }}>calendar coming soon</Text>
    </View>
  );
}
