import { Modal, View, Pressable, Text, StyleSheet, KeyboardAvoidingView, Platform, type ViewStyle } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* The sheet is pinned to the bottom edge, which is exactly where the
          keyboard arrives — so every sheet that holds a TextInput (Add walk-in,
          the modifier note, the register line editor's discount/modifier rows)
          used to be buried by it, the same way the sign-in card was. Shrinking
          this box by the keyboard height lets `backdrop`'s flex push the sheet
          to rest directly ON TOP of the keyboard instead of behind it. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, style]}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius.tile + 4,
    borderTopRightRadius: radius.tile + 4,
    borderTopWidth: 1,
    borderColor: color.borderStrong,
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 999, backgroundColor: color.borderStrong, marginBottom: space.sm },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
});
