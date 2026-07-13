import { View, Text, StyleSheet } from "react-native";
import { radius, space, fontFamily, fontSize, tableStatusColor, type TableStatus } from "@surge/design-tokens";

// Glanceable, color-encoded status (color + label). Table color escalates by wait
// time upstream via statusFromSeatedMinutes(); this just renders a status.
export function StatusChip({ status, label }: { status: TableStatus; label?: string }) {
  const c = tableStatusColor(status);
  return (
    <View style={[styles.chip, { backgroundColor: c + "22", borderColor: c }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.txt, { color: c }]}>{label ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  txt: { fontFamily: fontFamily.medium, fontSize: fontSize.caption },
});
