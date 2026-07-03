import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useState } from 'react';
import { Colors, Fonts, Spacing } from '../theme';
import { ViewSwitcher } from './ViewSwitcher';
import { AddTaskModal } from './AddTaskModal';

const ROUTE_LABELS: Record<string, string> = {
  '/calendar': 'Calendar',
  '/year': 'Year',
  '/settings': 'Settings',
};

export function BottomActionBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);

  const label = ROUTE_LABELS[pathname] ?? 'Calendar';

  return (
    <>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => setSwitcherVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.icon}>≡</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSwitcherVisible(true)} style={styles.labelBtn}>
          <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/search')} style={styles.iconBtn} hitSlop={8}>
          <Text style={styles.icon}>⌕</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAddVisible(true)} style={styles.iconBtn} hitSlop={8}>
          <Text style={[styles.icon, styles.addIcon]}>+</Text>
        </TouchableOpacity>
      </View>
      <ViewSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
      <AddTaskModal visible={addVisible} onClose={() => setAddVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 32,
  },
  iconBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  labelBtn: { flex: 1, alignItems: 'center' },
  icon: { fontSize: 24, color: Colors.text, lineHeight: 30 },
  addIcon: { color: Colors.accent, fontWeight: '300', fontSize: 28 },
  label: { fontSize: 16, color: Colors.text, letterSpacing: 0.3, fontFamily: Fonts.mono },
});
