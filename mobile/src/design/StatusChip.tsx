import { View, Text, StyleSheet } from "react-native";
import { radius, space, fontFamily, fontSize, tableStatusColor, type TableStatus } from "@surge/design-tokens";

// Glanceable, color-encoded status: tinted pill + dot + LABEL (never color alone).
// Pass a semantic `status` (table lifecycle) or an explicit `tint` + `label` for
// any other state (Preparing / Ready / Cancelled / Paid …). `solid` fills the
// pill with the tint and flips the text to white for the highest emphasis.
export function StatusChip({ status, tint, label, solid, size = "md" }: { status?: TableStatus; tint?: string; label?: string; solid?: boolean; size?: "sm" | "md" }) {
  const c = tint ?? (status ? tableStatusColor(status) : "#A7B0C2");
  const txt = label ?? status ?? "";
  return (
    <View style={[styles.chip, size === "sm" && styles.chipSm, solid ? { backgroundColor: c, borderColor: c } : { backgroundColor: c + "26", borderColor: c }]}>
      {!solid ? <View style={[styles.dot, { backgroundColor: c }]} /> : null}
      <Text style={[styles.txt, size === "sm" && styles.txtSm, { color: solid ? "#FFFFFF" : c }]} numberOfLines={1}>
        {txt}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  chipSm: { paddingHorizontal: space.sm, paddingVertical: 2, gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 999 },
  txt: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption },
  txtSm: { fontSize: fontSize.micro },
});
