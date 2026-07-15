import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, ScreenHeader, EmptyState, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { fetchOrderDetail, type SaleDetail, type SaleDetailLine } from "@/lib/reads";
import { money } from "@/lib/format";

const CHANNEL_LABEL: Record<string, string> = { dine_in: "Dine-in", takeout: "Takeout", pickup: "Pickup", delivery: "Delivery", online: "Online", kiosk: "Kiosk", qr: "QR" };
const label = (v: string | null) => (v ? CHANNEL_LABEL[v] ?? v.replace(/_/g, " ") : "");
const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const dateTimeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const STATUS: Record<string, { text: string; color: string }> = {
  paid: { text: "Paid", color: "#2FBF71" },
  voided: { text: "Voided", color: "#E5484D" },
  refunded: { text: "Refunded", color: "#F5A623" },
};

export default function OrderDetail() {
  const s = useSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<SaleDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (id) setD(await fetchOrderDetail(s.businessId!, id));
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    })();
  }, [id, s.businessId]);

  // Order timeline from the real timestamps we have (skip steps with none).
  const timeline = useMemo(() => {
    if (!d) return [];
    const steps: { label: string; at: string }[] = [];
    if (d.seatedAt) steps.push({ label: "Seated", at: d.seatedAt });
    steps.push({ label: "Ordered", at: d.createdAt });
    if (d.fulfilledAt) steps.push({ label: "Ready", at: d.fulfilledAt });
    return steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [d]);

  // Group line items by seat (Shared last) — the one grouping closed orders carry.
  const seatGroups = useMemo(() => {
    if (!d) return [];
    const by = new Map<number | null, SaleDetailLine[]>();
    for (const it of d.items) {
      const k = it.seat ?? null;
      (by.get(k) ?? by.set(k, []).get(k)!).push(it);
    }
    return [...by.entries()].sort((a, b) => (a[0] ?? 9999) - (b[0] ?? 9999));
  }, [d]);

  function reprint() {
    Alert.alert("Reprint", "Native receipt printing is coming soon — this is a placeholder.");
  }

  const st = d ? STATUS[d.status] : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title={d?.saleNumber != null ? "Sale #" + d.saleNumber : "Sale"}
        onBack={() => router.back()}
        backLabel="Back"
        right={d ? <Button title="Reprint" variant="ghost" onPress={reprint} /> : undefined}
      />

      {!loaded ? (
        <EmptyState>Loading…</EmptyState>
      ) : !d ? (
        <EmptyState>Sale not found.</EmptyState>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Summary */}
          <View style={styles.card}>
            <View style={styles.badges}>
              {st ? (
                <View style={[styles.badge, { borderColor: st.color }]}>
                  <Text style={[styles.badgeTxt, { color: st.color }]}>{st.text}</Text>
                </View>
              ) : null}
              <View style={[styles.badge, { borderColor: d.fulfilled ? "#2FBF71" : "#F5A623" }]}>
                <Text style={[styles.badgeTxt, { color: d.fulfilled ? "#2FBF71" : "#F5A623" }]}>{d.fulfilled ? "Ready" : "Preparing"}</Text>
              </View>
              {d.diningOption || d.channel ? (
                <View style={styles.chip}>
                  <Text style={styles.chipTxt}>{[label(d.diningOption), d.channel && d.channel !== d.diningOption ? label(d.channel) : null].filter(Boolean).join(" · ")}</Text>
                </View>
              ) : null}
            </View>
            <Text style={text.caption}>{dateTimeOf(d.createdAt)}</Text>
            <Text style={text.caption}>{[d.serverName ? "Server " + d.serverName : null, d.customerName, d.guests ? d.guests + " guests" : null].filter(Boolean).join(" · ") || "—"}</Text>
          </View>

          {/* Timeline */}
          {timeline.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Timeline</Text>
              {timeline.map((t, i) => (
                <View key={i} style={styles.tl}>
                  <View style={styles.tlDot} />
                  <Text style={styles.tlLabel}>{t.label}</Text>
                  <Text style={styles.tlTime}>{timeOf(t.at)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Items, grouped by seat */}
          <View style={styles.card}>
            {d.items.length === 0 && <Text style={text.bodyDim}>No line items on this sale.</Text>}
            {seatGroups.map(([seat, lines]) => (
              <View key={seat ?? "shared"} style={styles.group}>
                <Text style={styles.groupLabel}>{seat == null ? "Shared" : "Seat " + seat}</Text>
                {lines.map((it, i) => (
                  <View key={i} style={styles.line}>
                    <Text style={styles.qty}>{it.quantity}</Text>
                    <View style={styles.mid}>
                      <Text style={[styles.name, it.voided && styles.voided]}>{it.name}</Text>
                      {it.allergy ? <Text style={styles.allergy}>⚠ {it.allergy}</Text> : null}
                      {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
                    </View>
                    <Text style={[styles.lineTotal, it.voided && styles.voided]}>{money(it.unitPrice * it.quantity, "CAD")}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.card}>
            <Row label="Subtotal" value={money(d.subtotal, "CAD")} />
            {d.discount > 0 && <Row label="Discount" value={"-" + money(d.discount, "CAD")} />}
            {d.comp > 0 && <Row label="Comp" value={"-" + money(d.comp, "CAD")} />}
            {d.serviceCharge > 0 && <Row label="Service charge" value={money(d.serviceCharge, "CAD")} />}
            <Row label="Tax" value={money(d.tax, "CAD")} />
            {d.tip > 0 && <Row label="Tip" value={money(d.tip, "CAD")} />}
            <Row label="Total" value={money(d.total, "CAD")} bold />
            {d.payments.length > 0 && (
              <View style={styles.pays}>
                {d.payments.map((p, i) => (
                  <Row key={i} label={p.method} value={money(p.amount, "CAD")} dim />
                ))}
              </View>
            )}
            {d.refunds.length > 0 && (
              <View style={styles.pays}>
                {d.refunds.map((r, i) => (
                  <Row key={i} label={"Refund" + (r.reasonCode ? " · " + r.reasonCode : "")} value={"-" + money(r.amount, "CAD")} dim />
                ))}
              </View>
            )}
          </View>

          <Text style={[text.caption, { textAlign: "center" }]}>Read-only. Refunds are done from the register.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, bold, dim }: { label: string; value: string; bold?: boolean; dim?: boolean }) {
  return (
    <View style={styles.trow}>
      <Text style={[styles.rl, bold && styles.boldTxt, dim && { color: color.textDim }]}>{label}</Text>
      <Text style={[styles.rv, bold && styles.boldTxt, dim && { color: color.textDim }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md, maxWidth: 520, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.xs },
  cardLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: color.textDim, marginBottom: space.xs },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.xs, marginBottom: space.xs },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 1 },
  badgeTxt: { fontFamily: "Poppins_600SemiBold", fontSize: 11 },
  chip: { backgroundColor: color.card2, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  chipTxt: { fontFamily: "Poppins_500Medium", fontSize: 11, color: color.textDim },
  tl: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: 3 },
  tlDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: color.blue },
  tlLabel: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.text, flex: 1 },
  tlTime: { fontFamily: "Poppins_400Regular", fontSize: 13, color: color.textDim, fontVariant: ["tabular-nums"] },
  group: { gap: 2, marginBottom: space.sm },
  groupLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: color.textDim, marginBottom: 2 },
  line: { flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: color.border },
  qty: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.textDim, minWidth: 20 },
  mid: { flex: 1 },
  name: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  voided: { textDecorationLine: "line-through", color: color.textDim },
  allergy: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: color.late, marginTop: 1 },
  note: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim },
  lineTotal: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  trow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  rl: { fontFamily: "Poppins_400Regular", fontSize: 15, color: color.text },
  rv: { fontFamily: "Poppins_400Regular", fontSize: 15, color: color.text, fontVariant: ["tabular-nums"] },
  boldTxt: { fontFamily: "Poppins_600SemiBold" },
  pays: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.border, gap: 1 },
});
