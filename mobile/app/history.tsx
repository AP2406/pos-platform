import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SegmentedTabs, SearchField, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { fetchSalesHistory, type SaleRow, type SaleStatus } from "@/lib/reads";
import { money } from "@/lib/format";

type Range = "today" | "7d" | "30d";
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

function sinceFor(range: Range): string {
  if (range === "today") return new Date(new Date().toDateString()).toISOString();
  return new Date(Date.now() - (range === "7d" ? 7 : 30) * 86400000).toISOString();
}

const STATUS: Record<SaleStatus, { label: string; color: string }> = {
  paid: { label: "Paid", color: "#2FBF71" },
  voided: { label: "Voided", color: "#E5484D" },
  refunded: { label: "Refunded", color: "#F5A623" },
};

export default function History() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const [range, setRange] = useState<Range>("today");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await fetchSalesHistory(bizId, sinceFor(range)));
    } catch {
      /* ignore */
    }
  }, [bizId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => String(r.saleNumber ?? "").includes(q) || (r.customerName ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.hl}>
          {(s.access?.surfaces ?? []).includes("floor") && (
            <Pressable onPress={() => router.replace("/floor")} hitSlop={12}>
              <Text style={text.bodyDim}>‹ Floor</Text>
            </Pressable>
          )}
          <Text style={styles.title}>Sales</Text>
        </View>
        <SegmentedTabs tabs={RANGES} value={range} onChange={setRange} />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search — sale # or customer" />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {visible.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>No sales in this range.</Text>}
        {visible.map((r) => {
          const st = STATUS[r.status];
          return (
            <Pressable key={r.id} style={styles.row} onPress={() => router.push({ pathname: "/history/[id]", params: { id: r.id } })}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {r.saleNumber != null ? "#" + r.saleNumber : "Sale"}
                  {r.customerName ? " · " + r.customerName : ""}
                </Text>
                <Text style={styles.rowSub}>
                  {timeOf(r.createdAt)} · {r.method}
                  {r.serverName ? " · " + r.serverName : ""}
                </Text>
              </View>
              <View style={[styles.badge, { borderColor: st.color }]}>
                <Text style={[styles.badgeTxt, { color: st.color }]}>{st.label}</Text>
              </View>
              <Text style={styles.total}>{money(r.total, "CAD")}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={s.signOut} style={styles.signout}>
        <Text style={text.caption}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  hl: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  list: { padding: space.lg, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  rowSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeTxt: { fontFamily: "Poppins_500Medium", fontSize: 11 },
  total: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text, minWidth: 80, textAlign: "right" },
  signout: { alignItems: "center", paddingVertical: space.xs },
});
