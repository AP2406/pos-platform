import { View, Text, StyleSheet } from "react-native";
import { color, radius, space, fontFamily, fontSize } from "@surge/design-tokens";

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
  },
  label: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  value: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text, marginTop: space.xs },
});
