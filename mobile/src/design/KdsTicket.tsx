import { View, Text, StyleSheet } from "react-native";
import { Flame, TriangleAlert, Clock } from "lucide-react-native";
import { color, space, radius, fontFamily, fontSize } from "@surge/design-tokens";
import { Button } from "./Button";

export type KdsLine = { name: string; quantity: number; note: string | null; allergens: string[] };

// A single kitchen ticket: table/label + fire-time (aging color) + rush flag, the
// item lines (allergens bold-red), and a Ready / Recall action. The left rail and
// the timer share the aging color so "how long" reads from across the pass.
export function KdsTicket({
  label,
  elapsedLabel,
  agingColor,
  agingLabel,
  rush,
  fulfilled,
  items,
  onBump,
  onRecall,
  busy,
  readOnly,
}: {
  label: string;
  elapsedLabel: string;
  agingColor: string;
  agingLabel?: string | null; // "Running long" / "Late" — only when over a threshold
  rush?: boolean;
  fulfilled?: boolean;
  items: KdsLine[];
  onBump?: () => void;
  onRecall?: () => void;
  busy?: boolean;
  readOnly?: boolean; // glance mode (server) — hide the Ready/Recall action
}) {
  const count = items.reduce((n, it) => n + (it.quantity || 0), 0);
  return (
    <View style={[styles.card, { borderLeftColor: agingColor }, rush ? styles.rush : null]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          {rush ? <Flame size={18} color={color.warning} strokeWidth={2.25} /> : null}
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.timer}>
          <Clock size={15} color={agingColor} strokeWidth={2.5} />
          <Text style={[styles.time, { color: agingColor }]}>{elapsedLabel}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{count + (count === 1 ? " item" : " items")}</Text>
        {agingLabel ? (
          <View style={[styles.agingPill, { backgroundColor: agingColor }]}>
            <Text style={styles.agingTxt}>{agingLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.lines}>
        {items.map((it, i) => (
          <View key={i} style={styles.line}>
            <Text style={styles.qty}>{it.quantity}×</Text>
            <View style={styles.mid}>
              <Text style={styles.name}>{it.name}</Text>
              {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
              {it.allergens.length > 0 ? (
                <View style={styles.allergenRow}>
                  <TriangleAlert size={14} color={color.late} strokeWidth={2.5} />
                  <Text style={styles.allergen}>{it.allergens.join(", ").toUpperCase()}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {items.length === 0 ? <Text style={styles.note}>No items on this ticket.</Text> : null}
      </View>

      {readOnly ? (
        <Text style={styles.glance}>{fulfilled ? "Ready for pickup" : "In the kitchen"}</Text>
      ) : fulfilled ? (
        <Button title="Recall" variant="secondary" onPress={onRecall} loading={busy} />
      ) : (
        <Button title="Mark ready" variant="success" onPress={onBump} loading={busy} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    borderLeftWidth: 6,
    padding: space.md,
    gap: space.sm,
  },
  rush: { borderColor: color.warning },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  label: { flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.heading, color: color.text },
  timer: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, fontVariant: ["tabular-nums"] },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginTop: -4 },
  meta: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim },
  agingPill: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  agingTxt: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: "#FFFFFF" },
  lines: { gap: space.sm, paddingTop: space.xs, borderTopWidth: 1, borderTopColor: color.border },
  line: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  qty: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: color.text, minWidth: 28 },
  mid: { flex: 1 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: color.text },
  note: { fontFamily: fontFamily.medium, fontSize: 15, color: color.text, opacity: 0.85, marginTop: 1 },
  allergenRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  allergen: { fontFamily: fontFamily.semibold, fontSize: 15, color: color.late },
  glance: { fontFamily: fontFamily.medium, fontSize: fontSize.caption, color: color.textDim, textAlign: "center", paddingVertical: space.xs },
});
