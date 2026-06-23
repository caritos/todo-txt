import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTasks } from '../src/context/TaskContext';
import { setFilePath, LOCAL_PATH, ICLOUD_PATH } from '../src/store';
import { Colors, Fonts, Spacing } from '../src/theme';

export default function SettingsScreen() {
  const { filePath, reload } = useTasks();
  const insets = useSafeAreaInsets();
  const [pathInput, setPathInput] = useState(filePath);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    try {
      await setFilePath(pathInput.trim());
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }


  return (
    <ScrollView style={[styles.screen, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.sectionTitle}>Location</Text>
      <View style={styles.card}>
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[styles.presetBtn, pathInput === LOCAL_PATH && styles.presetBtnActive]}
            onPress={() => setPathInput(LOCAL_PATH ?? '')}
          >
            <Text style={[styles.presetBtnText, pathInput === LOCAL_PATH && styles.presetBtnTextActive]}>LOCAL</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetBtn, pathInput === ICLOUD_PATH && styles.presetBtnActive]}
            onPress={() => setPathInput(ICLOUD_PATH ?? '')}
          >
            <Text style={[styles.presetBtnText, pathInput === ICLOUD_PATH && styles.presetBtnTextActive]}>iCLOUD</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Todo File</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>File path</Text>
        <TextInput
          style={styles.input}
          value={pathInput}
          onChangeText={setPathInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="file:///..."
          placeholderTextColor={Colors.textSecondary}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current</Text>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  fieldLabel: { fontSize: 12, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    paddingVertical: Spacing.sm,
  },
  presetRow: { flexDirection: 'row', gap: Spacing.sm },
  presetBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.separator },
  presetBtnActive: { borderColor: Colors.accent },
  presetBtnText: { fontSize: 12, letterSpacing: 2, color: Colors.textSecondary },
  presetBtnTextActive: { color: Colors.accent },
  saveBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.accent, marginTop: Spacing.sm },
  saveBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '500' },
  currentPath: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary, lineHeight: 18 },
});
