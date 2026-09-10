import { Pressable, Text, StyleSheet } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

// Seat / course selector chip. Active = solid primary; ≥40pt tall for fingers.
export function SeatTab({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.active]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      <Text style={[styles.txt, active && styles.txtActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.card2,
    borderWidth: 1,
    borderColor: color.border,
  },
  active: { borderColor: color.blue, backgroundColor: color.blue },
  txt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  txtActive: { color: color.onPrimary, fontFamily: fontFamily.semibold },
});
