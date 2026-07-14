import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { fetchOrderDetail, type SaleDetail } from "@/lib/reads";
import { money } from "@/lib/format";

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

  const when = d ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d.createdAt)) : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={text.bodyDim}>‹ Sales</Text>
        </Pressable>
        <Text style={styles.title}>{d?.saleNumber != null ? "Sale #" + d.saleNumber : "Sale"}</Text>
      </View>

      {!loaded ? (
        <Text style={[text.bodyDim, styles.pad]}>Loading…</Text>
      ) : !d ? (
        <Text style={[text.bodyDim, styles.pad]}>Sale not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.card}>
            <Text style={text.caption}>{when}</Text>
            <Text style={text.caption}>
              {[d.diningOption?.replace("_", " "), d.serverName, d.customerName].filter(Boolean).join(" · ") || "—"}
            </Text>
            {d.status !== "paid" && (
              <Text style={[styles.status, { color: d.status === "voided" ? "#E5484D" : "#F5A623" }]}>
                {d.status === "voided" ? "VOIDED" : "REFUNDED"}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            {d.items.map((it, i) => (
              <View key={i} style={styles.line}>
                <Text style={styles.qty}>{it.quantity}</Text>
                <View style={styles.mid}>
                  <Text style={styles.name}>{it.name}</Text>
                  {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
                </View>
                <Text style={styles.lineTotal}>{money(it.unitPrice * it.quantity, "CAD")}</Text>
              </View>
            ))}
            {d.items.length === 0 && <Text style={text.bodyDim}>No line items on this sale.</Text>}
          </View>

          <View style={styles.card}>
            <Row label="Subtotal" value={money(d.subtotal, "CAD")} />
            {d.discount > 0 && <Row label="Discount" value={"-" + money(d.discount, "CAD")} />}
            {d.comp > 0 && <Row label="Comp" value={"-" + money(d.comp, "CAD")} />}
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

          <Text style={[text.caption, { textAlign: "center" }]}>Read-only. Refunds &amp; reprints are done from the register.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, bold, dim }: { label: string; value: string; bold?: boolean; dim?: boolean }) {
  return (
    <View style={styles.trow}>
      <Text style={[styles.rl, bold && styles.bold, dim && { color: color.textDim }]}>{label}</Text>
      <Text style={[styles.rv, bold && styles.bold, dim && { color: color.textDim }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, flexDirection: "row", alignItems: "baseline", gap: space.md },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  pad: { padding: space.lg },
  body: { padding: space.lg, gap: space.md, maxWidth: 520, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.xs },
  status: { fontFamily: "Poppins_600SemiBold", fontSize: 13, marginTop: space.xs },
  line: { flexDirection: "row", gap: space.md, alignItems: "flex-start", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: color.border },
  qty: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.textDim, minWidth: 20 },
  mid: { flex: 1 },
  name: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  note: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim },
  lineTotal: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  trow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  rl: { fontFamily: "Poppins_400Regular", fontSize: 15, color: color.text },
  rv: { fontFamily: "Poppins_400Regular", fontSize: 15, color: color.text, fontVariant: ["tabular-nums"] },
  bold: { fontFamily: "Poppins_600SemiBold" },
  pays: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.border, gap: 1 },
});
