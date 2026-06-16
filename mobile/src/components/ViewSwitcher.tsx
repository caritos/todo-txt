import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '../theme';
import { useTasks } from '../context/TaskContext';

type View_ = { label: string; route: string };

const VIEWS: View_[] = [
  { label: 'Day', route: '/day' },
  { label: 'Week', route: '/timeline' },
  { label: 'Month', route: '/month' },
  { label: 'Year', route: '/year' },
  { label: 'Calendar', route: '/calendar' },
  { label: 'Search', route: '/search' },
  { label: 'Settings', route: '/settings' },
];

type Props = { visible: boolean; onClose: () => void };

export function ViewSwitcher({ visible, onClose }: Props) {
  const router = useRouter();
  const { selectedDate } = useTasks();

  function navigate(route: string) {
    const target = route === '/day' ? `/day/${selectedDate}` : route;
    router.push(target as any);
    onClose();
  }

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          {VIEWS.map(v => (
            <TouchableOpacity key={v.route} style={styles.item} onPress={() => navigate(v.route)}>
              <Text style={styles.itemText}>{v.label}</Text>
            </TouchableOpacity>
          ))}
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
});
