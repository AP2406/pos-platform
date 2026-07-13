import { Pressable, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Clock, Users } from "lucide-react-native";
import { floor, fontFamily } from "@surge/design-tokens";

// A positioned floor element. Tables/booths are large, solid, saturated objects
// with a soft drop shadow: big bold white name on top; vacant tables show "N
// Seats", occupied tables show covers + a clock/timer + the running total.
// Counters/stations are dark fixtures (cash register / bar / host). No chairs.
export function TableShape(props: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  kind: string;
  fill?: string;
  label?: string | null;
  occupied?: boolean;
  seats?: number | null;
  covers?: number | null;
  timer?: string | null;
  total?: string | null;
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
  const big = Math.min(w, h) >= 68;
  const nameSize = big ? 17 : 12;
  return (
    <Pressable
      onPress={props.onPress}
      style={[base, styles.table, { borderRadius: round ? 9999 : 16, backgroundColor: props.fill ?? floor.vacant }]}
      accessibilityRole="button"
    >
      <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={2}>
        {props.label ?? ""}
      </Text>

      {props.occupied ? (
        big ? (
          <>
            {props.covers && props.covers > 0 ? (
              <View style={styles.row}>
                <Users size={12} color={floor.onTableDim} />
                <Text style={styles.meta}>{props.covers}</Text>
              </View>
            ) : null}
            {props.timer ? (
              <View style={styles.row}>
                <Clock size={12} color={floor.onTableDim} />
                <Text style={styles.meta}>{props.timer}</Text>
              </View>
            ) : null}
            {props.total ? <Text style={styles.total}>{props.total}</Text> : null}
          </>
        ) : props.total ? (
          <Text style={styles.totalCompact}>{props.total}</Text>
        ) : null
      ) : (
        <Text style={styles.seats}>{(props.seats ?? 0) + " Seats"}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 2,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  name: { fontFamily: fontFamily.semibold, color: floor.onTable, textAlign: "center", letterSpacing: 0.3 },
  seats: { fontFamily: fontFamily.regular, fontSize: 12, color: floor.onTableDim },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontFamily: fontFamily.regular, fontSize: 12, color: floor.onTableDim },
  total: { fontFamily: fontFamily.semibold, fontSize: 14, color: floor.onTable, marginTop: 1 },
  totalCompact: { fontFamily: fontFamily.semibold, fontSize: 12, color: floor.onTable },
  room: { borderWidth: 1, borderColor: floor.wall, borderStyle: "dashed", borderRadius: 12, alignItems: "flex-start", justifyContent: "flex-start", padding: 4 },
  roomTxt: { fontFamily: fontFamily.medium, fontSize: 11, color: "#8A7F6E" },
  fixture: { backgroundColor: floor.fixture, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingHorizontal: 6 },
  fixtureTxt: { fontFamily: fontFamily.semibold, fontSize: 11, color: floor.onTable, textAlign: "center", letterSpacing: 0.3 },
});
