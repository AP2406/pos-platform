import { View, Text, StyleSheet } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

// Summary tile: label, big number, optional one-line detail underneath.
export function StatCard({ label, value, detail, tint }: { label: string; value: string; detail?: string | null; tint?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tint ? { color: tint } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: 2,
  },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  value: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text, marginTop: space.xs, fontVariant: ["tabular-nums"] },
  detail: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textFaint },
});
