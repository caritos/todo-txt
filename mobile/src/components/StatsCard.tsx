import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../theme';

type Props = {
  label: string;
  count: number;
};

export function StatsCard({ label, count }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  count: { fontSize: 28, color: Colors.text, fontWeight: '300', lineHeight: 32 },
  label: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 },
});
