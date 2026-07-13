import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { color, fontFamily, fontSize } from "@surge/design-tokens";

// A single positioned floor element. Tables/booths are elevated, status-tinted
// objects with a status ring and a name/$/chips hierarchy. Seats render as
// intentional chair pills hugging their table (Square/TB style). Walls/rooms/
// labels/counters are quiet fixtures — never floating dark dots.
export function TableShape(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  kind: string;
  // table:
  statusColor?: string;
  fillColor?: string;
  sectionColor?: string | null;
  label?: string | null;
  total?: string | null;
  guests?: number | null;
  timeLabel?: string | null;
  // seat:
  seatTint?: string;
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

  // Chair pill hugging a table.
  if (kind === "seat") {
    return <View style={[base, { borderRadius: round ? 9999 : 6, backgroundColor: props.seatTint ?? color.card2, borderWidth: 1, borderColor: color.border }]} />;
  }
  // Structural / décor fixtures.
  if (kind === "wall") return <View style={[base, styles.wall, { borderRadius: 2 }]} />;
  if (kind === "room" || kind === "label") {
    return (
      <View style={[base, styles.room]}>
        {props.label ? (
          <Text style={styles.decorTxt} numberOfLines={1}>
            {props.label}
          </Text>
        ) : null}
      </View>
    );
  }
  if (kind === "counter" || kind === "station") {
    // A designed fixture (bar / host stand), not a placeholder box.
    return (
      <View style={[base, styles.fixture, { borderRadius: round ? 9999 : 10 }]}>
        <View style={styles.fixtureAccent} />
        {props.label ? (
          <Text style={styles.fixtureTxt} numberOfLines={1}>
            {props.label}
          </Text>
        ) : null}
      </View>
    );
  }

  // Interactive table / booth — an elevated object.
  const c = props.statusColor ?? color.available;
  const fill = props.fillColor ?? color.card;
  const compact = h < 58 || w < 74;
  return (
    <Pressable
      onPress={props.onPress}
      style={[base, styles.table, { borderRadius: round ? 9999 : 14, borderColor: c, backgroundColor: fill }]}
      accessibilityRole="button"
    >
      {props.sectionColor ? <View style={[styles.dot, { backgroundColor: props.sectionColor }]} /> : null}
      <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
        {props.label ?? ""}
      </Text>
      {props.total ? (
        <Text style={[styles.total, { color: c }]} numberOfLines={1}>
          {props.total}
        </Text>
      ) : null}
      {!compact && (props.guests || props.timeLabel) ? (
        <View style={styles.chips}>
          {props.guests && props.guests > 0 ? (
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{props.guests}p</Text>
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
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    gap: 2,
    overflow: "hidden",
    // soft elevation so tables read as objects on the floor
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dot: { position: "absolute", top: 5, left: 5, width: 8, height: 8, borderRadius: 999 },
  name: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.text },
  nameCompact: { fontSize: fontSize.caption },
  total: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption },
  chips: { flexDirection: "row", gap: 4, marginTop: 2 },
  chip: { backgroundColor: "rgba(11,14,20,0.55)", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  chipTxt: { fontFamily: fontFamily.medium, fontSize: 10, color: color.textDim },
  wall: { backgroundColor: color.border },
  room: { borderWidth: 1, borderColor: color.border, borderStyle: "dashed", borderRadius: 10, alignItems: "flex-start", justifyContent: "flex-start", padding: 4 },
  decorTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: color.textFaint },
  fixture: {
    backgroundColor: color.card2,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fixtureAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: color.textFaint },
  fixtureTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: color.textDim },
});
