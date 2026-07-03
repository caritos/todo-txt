import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../theme';

type NavItem = { label: string; route: string } | { separator: true };

const VIEWS: NavItem[] = [
  { label: 'Calendar', route: '/calendar' },
  { separator: true },
  { label: 'Year', route: '/year' },
  { separator: true },
  { label: 'Settings', route: '/settings' },
];

type Props = { visible: boolean; onClose: () => void };

export function ViewSwitcher({ visible, onClose }: Props) {
  const router = useRouter();

  function navigate(route: string) {
    router.push(route as any);
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {VIEWS.map((v, i) => {
            if ('separator' in v) {
              return <View key={`sep-${i}`} style={styles.separator} />;
            }
            return (
              <TouchableOpacity key={v.route} style={styles.item} onPress={() => navigate(v.route)}>
                <Text style={styles.itemText}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 44,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.separator,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  item: { paddingVertical: 16, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  itemText: { fontSize: 17, color: Colors.text },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginVertical: Spacing.xs,
  },
});
