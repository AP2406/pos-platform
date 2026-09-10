import { View, Pressable, Text, StyleSheet } from "react-native";
import { color, radius, space, touch, fontFamily, fontSize } from "@surge/design-tokens";

// A key is a digit, ".", or "back". Consumers decide what the value means (price,
// PIN, quantity). Keeps money/PIN logic out of the component.
export type NumKey = string;

export function NumPad({ onKey, decimal = true }: { onKey: (key: NumKey) => void; decimal?: boolean }) {
  const rows: NumKey[][] = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [decimal ? "." : "", "0", "back"],
  ];
  return (
    <View style={styles.pad}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((k, ki) => (
            <Pressable
              key={ki}
              disabled={k === ""}
              onPress={() => k !== "" && onKey(k)}
              style={[styles.key, k === "" && styles.keyEmpty]}
              accessibilityRole="button"
            >
              <Text style={styles.keyTxt}>{k === "back" ? "⌫" : k}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: space.sm },
  row: { flexDirection: "row", gap: space.sm },
  key: {
    flex: 1,
    minHeight: touch.min + 8,
    borderRadius: radius.card,
    backgroundColor: color.card2,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  keyEmpty: { backgroundColor: "transparent", borderColor: "transparent" },
  keyTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: color.text },
});
