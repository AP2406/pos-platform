import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { color, fontFamily, fontSize } from "@surge/design-tokens";

// A single positioned floor element, rendered exactly like the web floor: absolute
// left/top/width/height, round vs rect via `shape`, rotation. Tables/booths are
// interactive and carry the live check; walls/rooms/labels are décor.
export function TableShape({
  x,
  y,
  w,
  h,
  rotation,
  shape,
  kind,
  statusColor,
  sectionColor,
  label,
  total,
  meta,
  onPress,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  kind: string;
  statusColor?: string;
  sectionColor?: string | null;
  label?: string | null;
  total?: string | null;
  meta?: string | null;
  onPress?: () => void;
}) {
  const borderRadius = shape === "round" ? 9999 : kind === "wall" ? 2 : 12;
  const base: ViewStyle = {
    position: "absolute",
    left: x,
    top: y,
    width: w,
    height: h,
    borderRadius,
    transform: rotation ? [{ rotate: rotation + "deg" }] : undefined,
  };
  const compact = h < 56;

  // Décor (non-interactive).
  if (kind === "wall") return <View style={[base, styles.wall]} />;
  if (kind === "room" || kind === "label") {
    return (
      <View style={[base, styles.room]}>
        {label ? (
          <Text style={styles.decorTxt} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }
  if (kind === "seat") return <View style={[base, styles.seat]} />;
  if (kind === "counter" || kind === "station") {
    return (
      <View style={[base, styles.neutral]}>
        {label ? (
          <Text style={styles.neutralTxt} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }

  // Interactive table / booth.
  const c = statusColor ?? color.available;
  return (
    <Pressable onPress={onPress} style={[base, styles.table, { borderColor: c, backgroundColor: c + "22" }]} accessibilityRole="button">
      {sectionColor ? <View style={[styles.dot, { backgroundColor: sectionColor }]} /> : null}
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label ?? ""}
      </Text>
      {total ? (
        <Text style={[styles.total, { color: c }]} numberOfLines={1}>
          {total}
        </Text>
      ) : null}
      {!compact && meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    overflow: "hidden",
  },
  dot: { position: "absolute", top: 4, left: 4, width: 8, height: 8, borderRadius: 999 },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: color.text },
  labelCompact: { fontSize: 11 },
  total: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption },
  meta: { fontFamily: fontFamily.regular, fontSize: 10, color: color.textDim },
  wall: { backgroundColor: color.border },
  room: { borderWidth: 1, borderColor: color.border, borderStyle: "dashed", alignItems: "flex-start", justifyContent: "flex-start", padding: 4 },
  decorTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: color.textFaint },
  seat: { backgroundColor: color.card2, borderWidth: 1, borderColor: color.border },
  neutral: { backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center" },
  neutralTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: color.textDim },
});
