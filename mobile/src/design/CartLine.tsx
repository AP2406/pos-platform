import { View, Text, StyleSheet } from "react-native";
import { color, space, fontFamily, fontSize } from "@surge/design-tokens";

export function CartLine({ name, qty, price, note }: { name: string; qty: number; price: string; note?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.qty}>{qty}</Text>
      <View style={styles.mid}>
        <Text style={styles.name}>{name}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={styles.price}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  qty: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.textDim, minWidth: 20 },
  mid: { flex: 1 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim, marginTop: 2 },
  price: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.text },
});
