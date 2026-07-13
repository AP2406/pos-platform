import { Pressable, Text, StyleSheet } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

export function SeatTab({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.active]} accessibilityRole="button">
      <Text style={[styles.txt, active && styles.txtActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.card2,
    borderWidth: 1,
    borderColor: color.border,
  },
  active: { borderColor: color.blue, backgroundColor: color.blue + "22" },
  txt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  txtActive: { color: color.text },
});
