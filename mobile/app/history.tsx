import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Receipt } from "lucide-react-native";
import { SegmentedTabs, SearchField, ScreenHeader, EmptyState, StatCard, StatusChip, color, space, text, radius } from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { fetchSalesHistory, type SaleRow, type SaleStatus } from "@/lib/reads";
import { money } from "@/lib/format";

type Range = "today" | "7d" | "30d";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

function sinceFor(range: Range): string {
  if (range === "today") return new Date(new Date().toDateString()).toISOString();
  return new Date(Date.now() - (range === "7d" ? 7 : 30) * 86400000).toISOString();
}

const STATUS: Record<SaleStatus, { label: string; color: string }> = {
  paid: { label: "Paid", color: color.success },
  voided: { label: "Voided", color: color.late },
  refunded: { label: "Refunded", color: color.warning },
};

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", credit: "Card", debit: "Debit", house: "House account", gift: "Gift card", split: "Split", other: "Other" };
const methodLabel = (m: string) => METHOD_LABEL[m.toLowerCase()] ?? m.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p");

export default function History() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const hasFloor = (s.access?.surfaces ?? []).includes("floor");
  const [range, setRange] = useState<Range>("today");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchSalesHistory(bizId, sinceFor(range)));
    } catch {
      notify("Couldn't load the latest — check your connection.");
    } finally {
      setLoaded(true);
    }
  }, [bizId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", range === "today" ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  // Roll-ups over the paid + refunded sales in range (voided sales don't count).
  const summary = useMemo(() => {
    const counted = rows.filter((r) => r.status !== "voided");
    const net = counted.reduce((n, r) => n + r.total, 0);
    const tips = counted.reduce((n, r) => n + r.tip, 0);
    const avg = counted.length ? net / counted.length : 0;
    const byHour = new Array<number>(24).fill(0);
    for (const r of counted) byHour[new Date(r.createdAt).getHours()] += r.total;
    const items = new Map<string, { qty: number; sales: number }>();
    for (const r of counted)
      for (const l of r.lines) {
        const e = items.get(l.name) ?? { qty: 0, sales: 0 };
        e.qty += l.quantity;
        e.sales += l.unitPrice * l.quantity;
        items.set(l.name, e);
      }
    const top = [...items.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty || b.sales - a.sales)
      .slice(0, 5);
    const busiest = byHour.reduce((best, v, h) => (v > byHour[best] ? h : best), 0);
    const methods = new Map<string, { count: number; total: number }>();
    for (const r of counted) {
      const k = methodLabel(r.method);
      const e = methods.get(k) ?? { count: 0, total: 0 };
      e.count += 1;
      e.total += r.total;
      methods.set(k, e);
    }
    const byMethod = [...methods.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.total - a.total);
    return { net, tips, avg, count: counted.length, byHour, top, busiest, byMethod, refunds: rows.filter((r) => r.status === "refunded").length, voids: rows.filter((r) => r.status === "voided").length };
  }, [rows]);

  // Hourly chart window: the business day's active hours (first sale → last sale,
  // padded), never a wall of empty midnight bars.
  const hours = useMemo(() => {
    const active = summary.byHour.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
    if (active.length === 0) return [];
    const start = Math.max(0, Math.min(...active) - 1);
    const end = Math.min(23, Math.max(...active) + 1);
    const out: number[] = [];
    for (let h = start; h <= end; h++) out.push(h);
    return out;
  }, [summary]);
  const peak = Math.max(1, ...summary.byHour);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.saleNumber ?? "").includes(q) || (r.customerName ?? "").toLowerCase().includes(q) || (r.serverName ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Sales" subtitle={rangeLabel} onBack={hasFloor ? () => router.replace("/floor") : undefined} onSignOut={hasFloor ? undefined : s.signOut}>
        <SegmentedTabs tabs={RANGES} value={range} onChange={setRange} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.body}>
        {loaded && rows.length === 0 ? (
          <EmptyState
            icon={<Receipt size={26} color={color.textDim} strokeWidth={2} />}
            title={range === "today" ? "No sales yet today" : "No sales in this range"}
            body="Closed checks appear here with totals, payment method and top-selling items."
            actionLabel={range === "today" ? "Look at the last 7 days" : undefined}
            onAction={range === "today" ? () => setRange("7d") : undefined}
          />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.stats}>
              <StatCard label="Net sales" value={money(summary.net, "CAD")} detail={summary.refunds > 0 ? summary.refunds + (summary.refunds === 1 ? " refund" : " refunds") : "Paid checks"} />
              <StatCard label="Orders" value={String(summary.count)} detail={summary.voids > 0 ? summary.voids + " voided" : "Closed checks"} />
              <StatCard label="Average check" value={money(summary.avg, "CAD")} detail={summary.count > 0 ? "Busiest around " + hourLabel(summary.busiest) : null} />
              <StatCard label="Tips" value={money(summary.tips, "CAD")} detail={summary.net > 0 ? Math.round((summary.tips / summary.net) * 100) + "% of sales" : null} />
            </View>

            <View style={styles.twoUp}>
              {/* Sales by hour */}
              <View style={[styles.card, { flex: 1.4 }]}>
                <Text style={text.eyebrow}>Sales by hour</Text>
                {hours.length === 0 ? (
                  <Text style={[text.bodyDim, { paddingVertical: space.lg }]}>No sales to chart yet.</Text>
                ) : (
                  <View style={styles.chart}>
                    {hours.map((h) => {
                      const v = summary.byHour[h];
                      const pct = v / peak;
                      const isPeak = h === summary.busiest && v > 0;
                      return (
                        <View key={h} style={styles.barCol} accessibilityLabel={hourLabel(h) + ": " + money(v, "CAD")}>
                          <View style={styles.barTrack}>
                            <View style={[styles.bar, { height: Math.max(v > 0 ? 4 : 0, Math.round(pct * 96)), backgroundColor: isPeak ? color.blue : color.blueSoft, borderColor: color.blue }]} />
                          </View>
                          <Text style={[styles.barLabel, isPeak && { color: color.text }]}>{hourLabel(h)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Tenders — what came in by payment method (external terminals included). */}
              <View style={[styles.card, { flex: 0.8 }]}>
                <Text style={text.eyebrow}>By payment method</Text>
                {summary.byMethod.length === 0 ? (
                  <Text style={[text.bodyDim, { paddingVertical: space.lg }]}>Tenders appear once checks close.</Text>
                ) : (
                  summary.byMethod.map((m) => (
                    <View key={m.label} style={styles.methodRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topName}>{m.label}</Text>
                        <Text style={styles.topSub}>{m.count + (m.count === 1 ? " check" : " checks") + " · " + Math.round((m.total / Math.max(1, summary.net)) * 100) + "%"}</Text>
                      </View>
                      <Text style={styles.topSales}>{money(m.total, "CAD")}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Top items */}
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={text.eyebrow}>Top items</Text>
                {summary.top.length === 0 ? (
                  <Text style={[text.bodyDim, { paddingVertical: space.lg }]}>Line items appear once checks close.</Text>
                ) : (
                  summary.top.map((it, i) => (
                    <View key={it.name} style={styles.topRow}>
                      <Text style={styles.topRank}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.topName} numberOfLines={1}>
                          {it.name}
                        </Text>
                        <Text style={styles.topSub}>{it.qty + " sold"}</Text>
                      </View>
                      <Text style={styles.topSales}>{money(it.sales, "CAD")}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Sales list */}
            <View style={styles.listHead}>
              <Text style={text.eyebrow}>{rows.length + (rows.length === 1 ? " check" : " checks")}</Text>
              <View style={{ flex: 1, maxWidth: 360 }}>
                <SearchField value={query} onChangeText={setQuery} placeholder="Search by check #, guest or server" />
              </View>
            </View>
            {visible.length === 0 && <EmptyState compact title="No checks match" body="Try a check number, guest name or server." />}
            {visible.map((r) => {
              const st = STATUS[r.status];
              return (
                <Pressable key={r.id} style={styles.row} onPress={() => router.push({ pathname: "/history/[id]", params: { id: r.id } })} accessibilityRole="button">
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {r.saleNumber != null ? "#" + r.saleNumber : "Sale"}
                      {r.customerName ? " · " + r.customerName : ""}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {timeOf(r.createdAt)} · {methodLabel(r.method)}
                      {r.serverName ? " · " + r.serverName : ""}
                      {r.lines.length > 0 ? " · " + r.lines.reduce((n, l) => n + l.quantity, 0) + " items" : ""}
                    </Text>
                  </View>
                  <StatusChip tint={st.color} label={st.label} size="sm" />
                  <Text style={styles.total}>{money(r.total, "CAD")}</Text>
                  <ChevronRight size={18} color={color.textFaint} strokeWidth={2.25} />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.lg, gap: space.md },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  twoUp: { flexDirection: "row", gap: space.md, flexWrap: "wrap" },
  card: { minWidth: 250, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.sm },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, paddingTop: space.sm },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { height: 100, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, borderWidth: 1 },
  barLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: color.textFaint },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: color.border },
  methodRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border },
  topRank: { width: 24, fontFamily: "Poppins_600SemiBold", fontSize: 16, color: color.textDim, textAlign: "center" },
  topName: { fontFamily: "Poppins_500Medium", fontSize: 16, color: color.text },
  topSub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: color.textDim },
  topSales: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text, fontVariant: ["tabular-nums"] },
  listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, marginTop: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 64 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
  rowSub: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  total: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text, minWidth: 96, textAlign: "right", fontVariant: ["tabular-nums"] },
});
