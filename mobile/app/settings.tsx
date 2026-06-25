import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { setFilePath, LOCAL_PATH, ICLOUD_PATH } from '../src/store';
import { Colors, Fonts, Spacing } from '../src/theme';

export default function SettingsScreen() {
  const { filePath, reload } = useTasks();
  const insets = useSafeAreaInsets();

  async function handleSelect(path: string) {
    try {
      await setFilePath(path);
      await reload();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  return (
    <ScrollView style={[styles.screen, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.sectionTitle}>Location</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.option, filePath === LOCAL_PATH && styles.optionActive]}
          onPress={() => handleSelect(LOCAL_PATH ?? '')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionLabel, filePath === LOCAL_PATH && styles.optionLabelActive]}>LOCAL</Text>
          <Text style={styles.optionDesc}>Stored on this device only.</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={[styles.option, filePath === ICLOUD_PATH && styles.optionActive]}
          onPress={() => handleSelect(ICLOUD_PATH ?? '')}
          activeOpacity={0.7}
        >
          <Text style={[styles.optionLabel, filePath === ICLOUD_PATH && styles.optionLabelActive]}>iCLOUD</Text>
          <Text style={styles.optionDesc}>Syncs across devices and with the Mac CLI.</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current path</Text>
      <View style={styles.card}>
        <Text style={styles.currentPath}>{filePath}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  sectionTitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '600',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 4,
  },
  optionActive: {},
  optionLabel: {
    fontSize: 13,
    letterSpacing: 2,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  optionLabelActive: { color: Colors.accent },
  optionDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginLeft: Spacing.md,
  },
  currentPath: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary, lineHeight: 18, padding: Spacing.md },
});
