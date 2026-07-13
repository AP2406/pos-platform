import { Pressable, View, Text, StyleSheet } from "react-native";
import { color, radius, space, touch, fontFamily, fontSize, tableStatusColor, statusFromSeatedMinutes } from "@surge/design-tokens";

// A floor tile for an open check. Status color escalates by how long the check has
// been open (statusFromSeatedMinutes); `elapsedLabel` is the pre-formatted duration
// (capped upstream so it never shows "23d 6h").
export function TableCard({
  label,
  sub,
  minutes,
  elapsedLabel,
  checkDropped,
  onPress,
}: {
  label: string;
  sub?: string;
  minutes: number | null;
  elapsedLabel: string;
  checkDropped?: boolean;
  onPress?: () => void;
}) {
  const status = checkDropped ? "paid" : statusFromSeatedMinutes(minutes);
  const c = tableStatusColor(status);
  return (
    <Pressable onPress={onPress} style={[styles.card, { borderColor: c }]} accessibilityRole="button">
      <View style={[styles.bar, { backgroundColor: c }]} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
      <Text style={[styles.mins, { color: c }]}>{elapsedLabel}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.tile,
    borderWidth: 1,
    padding: space.md,
    minHeight: touch.min * 1.75,
    minWidth: touch.min * 2.25,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  bar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.text },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim, marginTop: 2 },
  mins: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, marginTop: space.sm },
});
