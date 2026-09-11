import { View, Text, StyleSheet } from "react-native";
import { color, space, fontFamily, fontSize, radius } from "@surge/design-tokens";
import { SurgeIcon } from "./SurgeIcon";

// Compact product identity for the top-left of the Floor: the SURGE wordmark
// beside "Business · Room". Reads as a header, not a screen title — the screen
// itself (Map / Board) is announced by the controls under it.
export function Brand({ business, room, compact, demo }: { business: string | null | undefined; room?: string | null; compact?: boolean; demo?: boolean }) {
  const where = [business || "Surge POS", room || null].filter(Boolean).join(" · ");
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={"Surge — " + where}>
      {/* THE ICON, NOT THE LOCKUP, and not the old "SURGE" chip either. This
          row already carries the business name and the room next to it, so
          there is no space for a 220pt lockup; the kit's answer to a mark at
          this size is its dedicated optical icon, so that is what this is.
          The chip it replaces was white text on brand blue at 12pt — the one
          size where the kit blue's 3.39:1 mattered most. There is no text on
          the mark any more, so the question does not arise. */}
      <SurgeIcon size={24} />
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
  where: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text, flexShrink: 1 },
  whereCompact: { fontSize: fontSize.body },
  demo: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.control, borderWidth: 1, borderColor: color.warning, backgroundColor: color.warningSoft },
  demoTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, letterSpacing: 1.5, color: color.warning },
});
