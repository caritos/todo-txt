import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../theme';
import { cleanTitle } from '../uiUtils';

export function VoiceAddButton({
  isListening,
  onPressIn,
  onPressOut,
}: {
  isListening: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}) {
  return (
    <TouchableOpacity onPressIn={onPressIn} onPressOut={onPressOut} style={styles.iconBtn} hitSlop={8}>
      <Text style={[styles.icon, isListening && styles.iconListening]}>{isListening ? '■' : '●'}</Text>
    </TouchableOpacity>
  );
}

export function VoiceAddToast({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText} numberOfLines={1}>
        Added: {cleanTitle(text)}
      </Text>
      <TouchableOpacity onPress={onUndo} hitSlop={8}>
        <Text style={styles.toastUndo}>UNDO</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  icon: { fontSize: 20, color: Colors.accent, lineHeight: 30 },
  iconListening: { color: Colors.text },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  toastText: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.mono,
    fontSize: 13,
    marginRight: Spacing.md,
  },
  toastUndo: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
