import { View, Text, StyleSheet } from "react-native";
import { TriangleAlert, Check } from "lucide-react-native";
import { color, space, fontFamily, fontSize, radius } from "@surge/design-tokens";

// One line on the check: quantity badge, name, tags (seat · course · discount),
// kitchen note / allergy, and the line total. `fired` marks lines already sent.
export function CartLine({ name, qty, price, note, allergy, tags, fired }: { name: string; qty: number; price: string; note?: string; allergy?: string; tags?: string[]; fired?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.qtyBox}>
        <Text style={styles.qty}>{qty}</Text>
      </View>
      <View style={styles.mid}>
        <Text style={styles.name}>{name}</Text>
        {tags && tags.length > 0 ? (
          <View style={styles.tags}>
            {fired ? (
              <View style={[styles.tag, styles.tagFired]}>
                <Check size={12} color={color.success} strokeWidth={3} />
                <Text style={[styles.tagTxt, { color: color.success }]}>Sent</Text>
              </View>
            ) : null}
            {tags.map((t, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagTxt}>{t}</Text>
              </View>
            ))}
          </View>
        ) : fired ? (
          <View style={styles.tags}>
            <View style={[styles.tag, styles.tagFired]}>
              <Check size={12} color={color.success} strokeWidth={3} />
              <Text style={[styles.tagTxt, { color: color.success }]}>Sent</Text>
            </View>
          </View>
        ) : null}
        {allergy ? (
          <View style={styles.allergyRow}>
            <TriangleAlert size={14} color={color.late} strokeWidth={2.5} />
            <Text style={styles.allergy}>{allergy}</Text>
          </View>
        ) : null}
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
    paddingVertical: space.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  qtyBox: { minWidth: 30, height: 30, borderRadius: radius.control, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  qty: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: color.text },
  mid: { flex: 1, gap: 3 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text, lineHeight: 21 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  tag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border },
  tagFired: { backgroundColor: color.successSoft, borderColor: "transparent" },
  tagTxt: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: color.textDim },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  allergyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  allergy: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: color.late },
  price: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.text, fontVariant: ["tabular-nums"], paddingTop: 4 },
});
