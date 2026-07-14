import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SegmentedTabs, Button, ScreenHeader, EmptyState, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchOrdersHub, type OrderHubRow } from "@/lib/reads";
import { ordersFulfill } from "@/lib/api";
import { money } from "@/lib/format";

type Channel = "dine_in" | "takeout" | "pickup" | "delivery" | "online" | "kiosk" | "qr";
const CHANNEL_LABEL: Record<Channel, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  pickup: "Pickup",
  delivery: "Delivery",
  online: "Online",
  kiosk: "Kiosk",
  qr: "QR",
};

// Collapse channel + dining option into one fulfillment channel (mirrors the web hub).
function channelOf(o: OrderHubRow): Channel {
  const ch = (o.channel || "").toLowerCase();
  if (ch === "online") return "online";
  if (ch === "kiosk") return "kiosk";
  if (ch === "qr") return "qr";
  if (ch === "delivery") return "delivery";
  const d = (o.diningOption || "").toLowerCase();
  if (d === "takeout") return "takeout";
  if (d === "pickup") return "pickup";
  if (d === "delivery") return "delivery";
  return "dine_in";
}

export default function Orders() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  const hasFloor = (s.access?.surfaces ?? []).includes("floor");

  const [rows, setRows] = useState<OrderHubRow[]>([]);
  const [chan, setChan] = useState<Channel | "all">("all");
  const [view, setView] = useState<"active" | "completed">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      setRows(await fetchOrdersHub(bizId));
    } catch {
      /* transient */
    }
  }, [bizId]);

  useEffect(() => {
    setNow(Date.now());
    load();
    const channel = realtimeChannel("orders-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "business_id=eq." + bizId }, () => load())
      .subscribe();
    const iv = setInterval(() => {
      setNow(Date.now());
      load();
    }, 30000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [bizId, load]);

  async function fulfill(id: string, op: "ready" | "reopen") {
    setBusyId(id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, fulfilledAt: op === "ready" ? new Date(now || Date.now()).toISOString() : null } : r)));
    try {
      await ordersFulfill(bizId, staffId, id, op);
    } catch {
      /* realtime/interval re-syncs */
    } finally {
      setBusyId(null);
      load();
    }
  }

  const present = useMemo(() => {
    const set = new Set<Channel>();
    for (const r of rows) set.add(channelOf(r));
    return (["dine_in", "takeout", "pickup", "delivery", "online", "kiosk", "qr"] as Channel[]).filter((c) => set.has(c));
  }, [rows]);

  const chanTabs = useMemo(() => [{ key: "all" as const, label: "All" }, ...present.map((c) => ({ key: c, label: CHANNEL_LABEL[c] }))], [present]);

  const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const visible = useMemo(() => {
    return rows
      .filter((r) => (view === "active" ? !r.fulfilledAt : !!r.fulfilledAt))
      .filter((r) => chan === "all" || channelOf(r) === chan)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rows, view, chan]);

  const activeCount = rows.filter((r) => !r.fulfilledAt).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Orders"
        subtitle={activeCount + " active"}
        onBack={hasFloor ? () => router.replace("/floor") : undefined}
        onSignOut={hasFloor ? undefined : s.signOut}
        right={
          <View style={styles.toggle}>
            <Pressable onPress={() => setView("active")} style={[styles.toggleBtn, view === "active" && styles.toggleOn]}>
              <Text style={[text.caption, view === "active" && { color: color.text }]}>Active</Text>
            </Pressable>
            <Pressable onPress={() => setView("completed")} style={[styles.toggleBtn, view === "completed" && styles.toggleOn]}>
              <Text style={[text.caption, view === "completed" && { color: color.text }]}>Completed</Text>
            </Pressable>
          </View>
        }
      >
        <SegmentedTabs tabs={chanTabs} value={chan} onChange={setChan} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.list}>
        {visible.length === 0 && <EmptyState>{"No " + view + " orders."}</EmptyState>}
        {visible.map((r) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>
                {r.saleNumber != null ? "#" + r.saleNumber : "Order"}
                {r.customerName ? " · " + r.customerName : ""}
              </Text>
              <Text style={styles.rowSub}>
                {CHANNEL_LABEL[channelOf(r)]} · {timeOf(r.createdAt)}
              </Text>
            </View>
            <Text style={styles.total}>{money(r.total, "CAD")}</Text>
            {view === "active" ? (
              <Button title="Mark ready" onPress={() => fulfill(r.id, "ready")} loading={busyId === r.id} />
            ) : (
              <Button title="Reopen" variant="secondary" onPress={() => fulfill(r.id, "reopen")} loading={busyId === r.id} />
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  toggle: { flexDirection: "row", backgroundColor: color.card, borderRadius: 999, padding: 2, borderWidth: 1, borderColor: color.border },
  toggleBtn: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 999 },
  toggleOn: { backgroundColor: color.card2 },
  list: { padding: space.lg, gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: 12, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: "Poppins_500Medium", fontSize: 15, color: color.text },
  rowSub: { fontFamily: "Poppins_400Regular", fontSize: 12, color: color.textDim, marginTop: 1 },
  total: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: color.text, minWidth: 72, textAlign: "right" },
});
