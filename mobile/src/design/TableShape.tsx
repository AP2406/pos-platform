import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { color, floor, fontFamily } from "@surge/design-tokens";

// A positioned floor element for the lit, lighter floor. Tables are SOLID slate
// objects that pop: big white number, a bold status ring + subtle status tint,
// and muted $ / time chips at the bottom. Chairs are drawn separately (see
// floor.tsx, synthesized by seat count). Walls/rooms/labels/counters are quiet
// fixtures toned for the light floor.
export function TableShape(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  kind: string;
  statusColor?: string;
  tint?: string | null;
  sectionColor?: string | null;
  label?: string | null;
  total?: string | null;
  timeLabel?: string | null;
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

  if (kind === "wall") return <View style={[base, { backgroundColor: floor.wall, borderRadius: 2 }]} />;
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
      <View style={[base, styles.fixture, { borderRadius: round ? 9999 : 10 }]}>
        {props.label ? (
          <Text style={styles.fixtureTxt} numberOfLines={1}>
            {props.label}
          </Text>
        ) : null}
      </View>
    );
  }

  // Interactive table / booth.
  const ring = props.statusColor ?? floor.wall;
  const radius = round ? 9999 : 14;
  const big = Math.min(w, h) >= 62;
  return (
    <Pressable onPress={props.onPress} style={[base, styles.table, { borderRadius: radius, borderColor: ring }]} accessibilityRole="button">
      {props.tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: props.tint, borderRadius: radius }]} /> : null}
      {props.sectionColor ? <View style={[styles.dot, { backgroundColor: props.sectionColor }]} /> : null}
      <Text style={[styles.name, { fontSize: big ? 18 : 14 }]} numberOfLines={1}>
        {props.label ?? ""}
      </Text>
      {props.total || props.timeLabel ? (
        <View style={styles.chips}>
          {props.total ? (
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{props.total}</Text>
            </View>
          ) : null}
          {props.timeLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{props.timeLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: floor.table,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // strong-ish elevation so the object lifts off the light floor
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  dot: { position: "absolute", top: 6, left: 6, width: 9, height: 9, borderRadius: 999 },
  name: { fontFamily: fontFamily.semibold, color: floor.onTable, textAlign: "center", paddingHorizontal: 4 },
  chips: { position: "absolute", bottom: 5, flexDirection: "row", gap: 4, alignItems: "center" },
  chip: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  chipTxt: { fontFamily: fontFamily.medium, fontSize: 10, color: floor.onTableDim },
  room: { borderWidth: 1, borderColor: floor.wall, borderStyle: "dashed", borderRadius: 10, alignItems: "flex-start", justifyContent: "flex-start", padding: 4 },
  roomTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: floor.fixture },
  fixture: { backgroundColor: floor.fixture, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fixtureTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: floor.onTable },
});
