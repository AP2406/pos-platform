import { Pressable, View, Text, StyleSheet } from "react-native";
import { Clock } from "lucide-react-native";
import { color, radius, space, fontFamily, fontSize, serviceStageColor, aging, AGING_LABEL, type ServiceStage, type AgingTier } from "@surge/design-tokens";
import { StatusChip } from "./StatusChip";

// Floor "Board" card — one open check. Standard anatomy, same as the map tile:
//   1. name (full width — never fights the pills for room)
//   2. state pill (+ "Late" badge when over the red threshold)
//   3. guests · server
//   4. running total · elapsed (amber once over the yellow threshold)
// The stage color drives the left bar + pill; red is reserved for "Late".
export function TableCard({
  label,
  stage,
  stageLabel,
  serverName,
  guests,
  sub,
  total,
  durationLabel,
  agingTier,
  lateBy,
  onPress,
}: {
  label: string;
  stage: ServiceStage;
  stageLabel: string;
  serverName?: string | null;
  guests?: number | null;
  sub?: string | null;
  total?: string | null;
  durationLabel: string;
  agingTier?: AgingTier;
  lateBy?: number; // minutes past the red threshold (badge reads "Late 25m")
  onPress?: () => void;
}) {
  const c = serviceStageColor(stage);
  const who = [guests && guests > 0 ? guests + (guests === 1 ? " guest" : " guests") : null, serverName ?? null].filter(Boolean).join(" · ") || sub || "";
  const late = agingTier === "late";
  const warn = agingTier === "warning";
  const timeColor = late ? aging.late : warn ? aging.warning : color.textDim;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { borderColor: late ? aging.late : color.border }, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label + ", " + stageLabel + (who ? ", " + who : "") + (total ? ", " + total : "") + ", " + durationLabel}>
      <View style={[styles.bar, { backgroundColor: c }]} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.pills}>
        <StatusChip tint={c} label={stageLabel} />
        {late ? <StatusChip tint={aging.late} label={AGING_LABEL.late + (lateBy && lateBy > 0 ? " " + (lateBy < 60 ? lateBy + "m" : Math.floor(lateBy / 60) + "h") : "")} solid /> : null}
      </View>
      <Text style={styles.sub} numberOfLines={1}>
        {who || " "}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.total}>{total ?? "—"}</Text>
        <View style={styles.time}>
          <Clock size={14} color={timeColor} strokeWidth={2.25} />
          <Text style={[styles.dur, { color: timeColor }]}>{durationLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 236,
    backgroundColor: color.card,
    borderRadius: radius.tile,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingRight: space.md,
    paddingLeft: space.md + 6,
    gap: 6,
    overflow: "hidden",
  },
  pressed: { backgroundColor: color.card2 },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
  pills: { flexDirection: "row", alignItems: "center", gap: space.xs, flexWrap: "wrap" },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginTop: 2 },
  total: { fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text, fontVariant: ["tabular-nums"] },
  time: { flexDirection: "row", alignItems: "center", gap: 4 },
  dur: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, fontVariant: ["tabular-nums"] },
});
