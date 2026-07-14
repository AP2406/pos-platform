import { View, Text, StyleSheet } from "react-native";
import { color, space, radius, fontFamily, fontSize } from "@surge/design-tokens";
import { Button } from "./Button";

export type KdsLine = { name: string; quantity: number; note: string | null; allergens: string[] };

// A single kitchen ticket: table/label + fire-time (aging color) + rush flag, the
// item lines (allergens bold-red), and a Ready / Recall action.
export function KdsTicket({
  label,
  elapsedLabel,
  agingColor,
  rush,
  fulfilled,
  items,
  onBump,
  onRecall,
  busy,
}: {
  label: string;
  elapsedLabel: string;
  agingColor: string;
  rush?: boolean;
  fulfilled?: boolean;
  items: KdsLine[];
  onBump?: () => void;
  onRecall?: () => void;
  busy?: boolean;
}) {
  return (
    <View style={[styles.card, { borderLeftColor: agingColor }, rush ? styles.rush : null]}>
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>
          {rush ? "🔥 " : ""}
          {label}
        </Text>
        <Text style={[styles.time, { color: agingColor }]}>{elapsedLabel}</Text>
      </View>

      <View style={styles.lines}>
        {items.map((it, i) => (
          <View key={i} style={styles.line}>
            <Text style={styles.qty}>{it.quantity}</Text>
            <View style={styles.mid}>
              <Text style={styles.name}>{it.name}</Text>
              {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
              {it.allergens.length > 0 ? (
                <Text style={styles.allergen}>⚠ {it.allergens.join(", ").toUpperCase()}</Text>
              ) : null}
            </View>
          </View>
        ))}
        {items.length === 0 ? <Text style={styles.note}>—</Text> : null}
      </View>

      {fulfilled ? (
        <Button title="Recall" variant="secondary" onPress={onRecall} loading={busy} />
      ) : (
        <Button title="Ready" onPress={onBump} loading={busy} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    borderLeftWidth: 5,
    padding: space.md,
    gap: space.sm,
  },
  rush: { borderColor: "#F5A623" },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm },
  label: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
  time: { fontFamily: fontFamily.semibold, fontSize: fontSize.body },
  lines: { gap: space.xs },
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  qty: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.textDim, minWidth: 18 },
  mid: { flex: 1 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: color.textDim },
  allergen: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: "#E5484D", marginTop: 1 },
});
