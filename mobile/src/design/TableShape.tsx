import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Clock } from "lucide-react-native";
import { color, floor, fontFamily, serviceStageColor, aging as agingColors, type ServiceStage } from "@surge/design-tokens";

// A positioned floor element. Tables/booths are DARK tiles with a state-colour
// accent (left edge on rectangles, ring on rounds) and the state written out —
// colour is never the only signal. "Payment due" gets a soft amber wash + amber
// edge so it draws the eye without shouting; the only solid fill is a table
// another server owns (neutral, so it reads as taken). "Late" adds a red border
// + badge only once the table is actually over the red threshold. Vacant →
// "N seats" + section.
// Counters/stations are dark fixtures. Bar stools are drawn separately (floor.tsx).
export function TableShape(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  kind: string;
  stage?: ServiceStage; // drives the accent colour + label colour
  fill?: string; // explicit override (e.g. another server's table)
  ring?: string;
  label?: string | null;
  occupied?: boolean;
  seats?: number | null;
  sectionName?: string | null;
  covers?: number | null;
  timer?: string | null;
  total?: string | null;
  stageLabel?: string | null; // "Open" / "Sent" / "Ready" / "Payment due"
  serverName?: string | null; // server's first name
  agingLabel?: string | null; // "Late 25m" — only over the red threshold
  timerColor?: string | null; // amber once over the yellow threshold
  onPress?: () => void;
}) {
  const { x, y, w, h, rotation, shape, kind } = props;
  const round = shape === "round";
  const base: ViewStyle = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    transform: rotation ? [{ rotate: rotation + "deg" }] : undefined,
  };

  if (kind === "wall") return <View style={[base, { backgroundColor: floor.wall, borderRadius: 3 }]} />;
  if (kind === "room" || kind === "label") {
    return (
      <View style={[base, styles.room]}>
        {props.label ? (
          <Text style={styles.roomTxt} numberOfLines={1}>
            {props.label}
          </Text>
        ) : null}
      </View>
    );
  }
  if (kind === "counter" || kind === "station") {
    return (
      <View style={[base, styles.fixture, { borderRadius: round ? 9999 : 12 }]}>
        {props.label ? (
          <Text style={styles.fixtureTxt} numberOfLines={2}>
            {props.label}
          </Text>
        ) : null}
      </View>
    );
  }

  // Interactive table / booth.
  const big = Math.min(w, h) >= 84; // rich layout fits; else a compact fallback
  const stage = props.stage ?? (props.occupied ? "open" : "available");
  const accent = props.fill ?? serviceStageColor(stage);
  const late = !!props.agingLabel;
  const solid = !!props.fill; // filled tile only for an explicit override (another server's table)
  const attention = stage === "pay" && !solid; // payment due: dark tile with an amber wash + edge
  const vacant = !props.occupied;
  const surface = solid ? accent : attention ? "rgba(245,158,11,0.16)" : vacant ? "#171B28" : "#1E2438";
  const border = late ? agingColors.late : solid ? "rgba(255,255,255,0.18)" : attention ? accent : vacant ? color.borderStrong : round ? accent : color.borderStrong;
  const onSurface = solid ? "#FFFFFF" : color.text;
  const onSurfaceDim = solid ? "rgba(255,255,255,0.88)" : color.textDim;
  const stateColor = solid ? "#FFFFFF" : vacant ? color.textFaint : accent;
  // server · N line (either part may be absent)
  const who = [props.serverName ?? null, props.covers && props.covers > 0 ? props.covers + " guests" : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={props.onPress}
      style={[base, styles.table, { borderRadius: round ? 9999 : 14, backgroundColor: surface, borderColor: border, borderWidth: late ? 2.5 : attention ? 2 : round && !solid && !vacant ? 3 : 1.5 }]}
      accessibilityRole="button"
      accessibilityLabel={[props.label, props.stageLabel ?? (vacant ? "Available" : null), who, props.total, props.timer, props.agingLabel].filter(Boolean).join(", ")}
    >
      {/* State-colour edge on rectangular tiles (rounds use the ring above). */}
      {!round && !solid && !vacant ? <View style={[styles.edge, { backgroundColor: accent }]} /> : null}

      {late ? (
        <View style={styles.lateBadge}>
          <Text style={styles.lateTxt}>{props.agingLabel}</Text>
        </View>
      ) : null}

      <Text style={[styles.name, { fontSize: big ? 18 : 13, color: onSurface }]} numberOfLines={1}>
        {props.label ?? ""}
      </Text>

      {props.occupied ? (
        big ? (
          <>
            {props.stageLabel ? <Text style={[styles.stage, { color: stateColor }]} numberOfLines={1}>{props.stageLabel}</Text> : null}
            {who ? <Text style={[styles.meta, { color: onSurfaceDim }]} numberOfLines={1}>{who}</Text> : null}
            {props.total ? <Text style={[styles.total, { color: attention ? accent : onSurface }]}>{props.total}</Text> : null}
            {props.timer ? (
              <View style={styles.timerRow}>
                {props.timerColor ? <Clock size={12} color={solid ? "#FFFFFF" : props.timerColor} strokeWidth={3} /> : null}
                <Text style={[styles.dur, { color: props.timerColor && !solid ? props.timerColor : onSurfaceDim }, props.timerColor ? { fontFamily: fontFamily.semibold } : null]} numberOfLines={1}>
                  {props.timer}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {props.stageLabel ? <Text style={[styles.stageCompact, { color: stateColor }]} numberOfLines={1}>{props.stageLabel}</Text> : null}
            {props.total ? <Text style={[styles.totalCompact, { color: onSurface }]}>{props.total}</Text> : null}
          </>
        )
      ) : (
        <>
          <Text style={[styles.seats, { color: onSurfaceDim }]}>{(props.seats ?? 0) + " seats"}</Text>
          {big ? <Text style={[styles.stageAvail, { color: stateColor }]} numberOfLines={1}>Available</Text> : null}
          {big && props.sectionName ? (
            <Text style={[styles.section, { color: color.textFaint }]} numberOfLines={1}>
              {props.sectionName}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 1,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  edge: { position: "absolute", left: 0, top: 0, bottom: 0, width: 6 },
  name: { fontFamily: fontFamily.semibold, textAlign: "center", letterSpacing: 0.3 },
  seats: { fontFamily: fontFamily.medium, fontSize: 13 },
  section: { fontFamily: fontFamily.medium, fontSize: 12 },
  // Service-stage label: text (never colour-alone), uppercase, in the state colour.
  stage: { fontFamily: fontFamily.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 1 },
  stageCompact: { fontFamily: fontFamily.semibold, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
  stageAvail: { fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  meta: { fontFamily: fontFamily.medium, fontSize: 13, textAlign: "center" },
  total: { fontFamily: fontFamily.semibold, fontSize: 17, marginTop: 1, fontVariant: ["tabular-nums"] },
  dur: { fontFamily: fontFamily.medium, fontSize: 13, fontVariant: ["tabular-nums"] },
  totalCompact: { fontFamily: fontFamily.semibold, fontSize: 12 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  // Late badge — red, in-flow above the name, only when over the red threshold.
  lateBadge: { height: 18, borderRadius: 9, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", marginBottom: 1, backgroundColor: agingColors.late },
  lateTxt: { fontFamily: fontFamily.semibold, fontSize: 10, color: "#FFFFFF", letterSpacing: 0.4, textTransform: "uppercase" },
  room: { borderWidth: 1, borderColor: floor.wall, borderStyle: "dashed", borderRadius: 12, alignItems: "flex-start", justifyContent: "flex-start", padding: 4 },
  roomTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: "#8A7F6E" },
  fixture: { backgroundColor: floor.fixture, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingHorizontal: 6 },
  fixtureTxt: { fontFamily: fontFamily.semibold, fontSize: 11, color: floor.onTable, textAlign: "center", letterSpacing: 0.3 },
});
