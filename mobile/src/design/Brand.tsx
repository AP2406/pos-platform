import { View, Text, StyleSheet } from "react-native";
import { color, space, fontFamily, fontSize, radius } from "@surge/design-tokens";

// Compact product identity for the top-left of the Floor: the SURGE wordmark
// beside "Business · Room". Reads as a header, not a screen title — the screen
// itself (Map / Board) is announced by the controls under it.
export function Brand({ business, room, compact, demo }: { business: string | null | undefined; room?: string | null; compact?: boolean; demo?: boolean }) {
  const where = [business || "Surge POS", room || null].filter(Boolean).join(" · ");
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={"Surge — " + where}>
      <View style={styles.mark}>
        <Text style={styles.markTxt}>SURGE</Text>
      </View>
      <Text style={[styles.where, compact && styles.whereCompact]} numberOfLines={1}>
        {where}
      </Text>
      {demo ? (
        <View style={styles.demo}>
          <Text style={styles.demoTxt}>DEMO</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, flexShrink: 1 },
  mark: { paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: radius.control, backgroundColor: color.blue },
  markTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, letterSpacing: 2, color: color.onPrimary },
  where: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text, flexShrink: 1 },
  whereCompact: { fontSize: fontSize.body },
  demo: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.control, borderWidth: 1, borderColor: color.warning, backgroundColor: color.warningSoft },
  demoTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, letterSpacing: 1.5, color: color.warning },
});
