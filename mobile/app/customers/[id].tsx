import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { StatCard, ScreenHeader, EmptyState, StatusChip, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { fetchCustomerDetail, fetchCustomerOrders, fetchCustomerLedger, type CustomerDetail, type CustomerOrder, type LedgerEntry, type SaleStatus } from "@/lib/reads";
import { money } from "@/lib/format";

const dateOf = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

const STATUS_COLOR: Record<SaleStatus, string> = { paid: color.success, voided: color.late, refunded: color.warning };
const SOURCE_LABEL: Record<LedgerEntry["source"], string> = { loyalty: "Loyalty", credit: "Credit", house: "House" };

export default function CustomerProfile() {
  const s = useSession();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bizId = s.businessId!;

  const [d, setD] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const [prof, ords, led] = await Promise.all([fetchCustomerDetail(bizId, id), fetchCustomerOrders(bizId, id), fetchCustomerLedger(bizId, id)]);
        setD(prof);
        setOrders(ords);
        setLedger(led);
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    })();
  }, [id, bizId]);

  const fmtAmt = (e: LedgerEntry) => {
    const sign = e.amount > 0 ? "+" : "";
    return e.unit === "pts" ? sign + e.amount + " pts" : sign + money(e.amount, "CAD");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title={d?.name ?? "Customer"} onBack={() => router.back()} backLabel="Back" />

      {!loaded ? (
        <EmptyState compact title="Loading…" />
      ) : !d ? (
        <EmptyState title="Customer not found" body="This profile may have been merged or removed." actionLabel="Back" onAction={() => router.back()} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* Contact */}
          <View style={styles.card}>
            <Text style={styles.name}>{d.name}</Text>
            <Text style={text.bodyDim}>{[d.phone, d.email].filter(Boolean).join(" · ") || "No contact on file"}</Text>
            {d.taxExempt ? (
              <View style={styles.flags}>
                <View style={styles.flag}>
                  <Text style={styles.flagTxt}>Tax exempt</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Balances */}
          <View style={styles.stats}>
            <StatCard label="Loyalty" value={d.loyaltyPoints == null ? "—" : d.loyaltyPoints + " pts"} />
            <StatCard label="Store credit" value={money(d.storeCredit, "CAD")} />
            <StatCard label="House acct" value={d.houseAccount ? money(d.houseAccount.balance, "CAD") : "—"} />
          </View>
          {d.houseAccount ? (
            <Text style={styles.subtle}>
              House account {d.houseAccount.enabled ? "enabled" : "disabled"}
              {d.houseAccount.limit > 0 ? " · limit " + money(d.houseAccount.limit, "CAD") : ""}
            </Text>
          ) : null}
          <Text style={styles.subtle}>No loyalty-tier program is configured — points balance only.</Text>

          {/* Lifetime */}
          <View style={styles.stats}>
            <StatCard label="Visits" value={String(d.visits)} />
            <StatCard label="Lifetime spend" value={money(d.lifetimeSpend, "CAD")} />
            <StatCard label="Last visit" value={d.lastVisit ? dateOf(d.lastVisit) : "—"} />
          </View>

          {/* Notes (customers carry notes, not allergens — nothing invented) */}
          {d.notes ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Notes</Text>
              <Text style={text.body}>{d.notes}</Text>
            </View>
          ) : null}

          {/* Order history */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Orders ({orders.length})</Text>
            {orders.length === 0 && <Text style={text.bodyDim}>No orders yet — their first visit will show here.</Text>}
            {orders.map((o) => (
              <Pressable key={o.id} style={styles.row} onPress={() => router.push({ pathname: "/history/[id]", params: { id: o.id } })}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{o.saleNumber != null ? "#" + o.saleNumber : "Order"}</Text>
                  <Text style={styles.rowSub}>{dateOf(o.createdAt)}</Text>
                </View>
                {o.status !== "paid" ? <StatusChip tint={STATUS_COLOR[o.status]} label={o.status === "voided" ? "Voided" : "Refunded"} size="sm" /> : null}
                <Text style={styles.rowTotal}>{money(o.total, "CAD")}</Text>
                <ChevronRight size={18} color={color.textFaint} strokeWidth={2.25} />
              </Pressable>
            ))}
          </View>

          {/* Account activity (real ledger, merged) */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Account activity</Text>
            {ledger.length === 0 && <Text style={text.bodyDim}>No loyalty points, store credit or house-account activity yet.</Text>}
            {ledger.map((e, i) => (
              <View key={i} style={styles.ledRow}>
                <View style={[styles.srcChip, SRC_STYLE[e.source]]}>
                  <Text style={styles.srcTxt}>{SOURCE_LABEL[e.source]}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{e.kind.replace(/_/g, " ")}</Text>
                  <Text style={styles.rowSub}>
                    {dateOf(e.createdAt)}
                    {e.note ? " · " + e.note : ""}
                  </Text>
                </View>
                <Text style={[styles.ledAmt, { color: e.amount < 0 ? color.late : color.success }]}>{fmtAmt(e)}</Text>
              </View>
            ))}
          </View>

          <Text style={[text.caption, { textAlign: "center" }]}>Loyalty and credit adjustments are made in the Surge web dashboard.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md, maxWidth: 620, width: "100%", alignSelf: "center" },
  card: { backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.xs },
  cardLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: color.textDim, marginBottom: space.xs },
  name: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  flags: { flexDirection: "row", gap: space.xs, marginTop: space.xs },
  flag: { backgroundColor: color.card2, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  flagTxt: { fontFamily: "Poppins_500Medium", fontSize: 11, color: color.textDim },
  stats: { flexDirection: "row", gap: space.sm },
  subtle: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: -space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text, textTransform: "capitalize" },
  rowSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  rowTotal: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text, fontVariant: ["tabular-nums"] },
  badge: { fontFamily: "Poppins_600SemiBold", fontSize: 11, textTransform: "capitalize" },
  ledRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  ledAmt: { fontFamily: "Poppins_600SemiBold", fontSize: 14, fontVariant: ["tabular-nums"] },
  srcChip: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2, minWidth: 60, alignItems: "center" },
  srcTxt: { fontFamily: "Poppins_500Medium", fontSize: 11, color: color.text },
});

const SRC_STYLE: Record<LedgerEntry["source"], { backgroundColor: string }> = {
  loyalty: { backgroundColor: "rgba(37,99,235,0.18)" },
  credit: { backgroundColor: "rgba(47,191,113,0.18)" },
  house: { backgroundColor: "rgba(245,166,35,0.18)" },
};
