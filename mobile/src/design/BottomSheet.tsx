import { Modal, View, Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
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
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, style]}>
        <View style={styles.handle} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: color.card,
    borderTopLeftRadius: radius.tile,
    borderTopRightRadius: radius.tile,
    borderTopWidth: 1,
    borderColor: color.border,
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: color.border, marginBottom: space.sm },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
});
