import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Inbox, Clock } from "lucide-react-native";
import { SegmentedTabs, Button, ScreenHeader, EmptyState, StatusChip, color, space, radius } from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchOrdersHub, type OrderHubRow } from "@/lib/reads";
import { ordersFulfill } from "@/lib/api";
import { canBumpKds } from "@/lib/access";
import { formatElapsed, money } from "@/lib/format";

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

// One order state vocabulary for this screen: Active (being prepared), Completed
// (marked ready), Cancelled (voided). Same words in the filter and on the row.
type OrderState = "active" | "completed" | "cancelled";
const STATE_TABS: { key: OrderState; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];
const stateOf = (o: OrderHubRow): OrderState => (o.cancelled ? "cancelled" : o.fulfilledAt ? "completed" : "active");

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
  const canOrder = (s.access?.surfaces ?? []).includes("register");
  // Kitchen staff and managers move orders along; servers and hosts get a read-only view.
  const canFulfill = canBumpKds(s.staff?.role ?? "", s.deviceHome);

  const [rows, setRows] = useState<OrderHubRow[]>([]);
  const [chan, setChan] = useState<Channel | "all">("all");
  const [view, setView] = useState<OrderState>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fetchOrdersHub(bizId));
    } catch {
      notify("Couldn't load the latest — check your connection.");
    } finally {
      setLoaded(true);
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

  const chanTabs = useMemo(() => [{ key: "all" as const, label: "All channels" }, ...present.map((c) => ({ key: c, label: CHANNEL_LABEL[c] }))], [present]);

  const timeOf = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const counts = useMemo(() => {
    const c: Record<OrderState, number> = { active: 0, completed: 0, cancelled: 0 };
    for (const r of rows) if (chan === "all" || channelOf(r) === chan) c[stateOf(r)]++;
    return c;
  }, [rows, chan]);

  const visible = useMemo(() => {
    return rows
      .filter((r) => stateOf(r) === view)
      .filter((r) => chan === "all" || channelOf(r) === chan)
      .sort((a, b) => (view === "active" ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [rows, view, chan]);

  const EMPTY: Record<OrderState, { title: string; body: string }> = {
    active: { title: "No orders in progress", body: "Orders that are paid and waiting to be made show here, oldest first." },
    completed: { title: "Nothing completed yet today", body: "Orders you mark ready move here so you can reopen one if it was bumped by mistake." },
    cancelled: { title: "No cancelled orders today", body: "Voided orders are kept here for the day's record." },
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Orders"
        subtitle={"Today · " + counts.active + " active"}
        onBack={hasFloor ? () => router.replace("/floor") : undefined}
        onSignOut={hasFloor ? undefined : s.signOut}
        right={canOrder ? <Button title="New order" onPress={() => router.push("/register?mode=togo")} /> : undefined}
      >
        <View style={styles.filters}>
          <SegmentedTabs tabs={STATE_TABS} value={view} onChange={setView} counts={counts} />
          {chanTabs.length > 2 ? <SegmentedTabs tabs={chanTabs} value={chan} onChange={setChan} /> : null}
        </View>
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.list}>
        {loaded && visible.length === 0 && (
          <EmptyState
            icon={<Inbox size={26} color={color.textDim} strokeWidth={2} />}
            title={EMPTY[view].title}
            body={EMPTY[view].body}
            actionLabel={view === "active" && canOrder ? "New order" : undefined}
            onAction={view === "active" && canOrder ? () => router.push("/register?mode=togo") : undefined}
          />
        )}
        {visible.map((r) => {
          const st = stateOf(r);
          const tint = st === "active" ? color.warning : st === "completed" ? color.success : color.late;
          const label = st === "active" ? "Preparing" : st === "completed" ? "Ready" : "Cancelled";
          return (
            <View key={r.id} style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => router.push({ pathname: "/history/[id]", params: { id: r.id } })} accessibilityRole="button">
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.saleNumber != null ? "#" + r.saleNumber : "Order"}
                    {r.customerName ? " · " + r.customerName : ""}
                  </Text>
                  <StatusChip tint={tint} label={label} size="sm" />
                </View>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {CHANNEL_LABEL[channelOf(r)]} · {timeOf(r.createdAt)}
                  {r.itemCount > 0 ? " · " + r.itemCount + (r.itemCount === 1 ? " item" : " items") : ""}
                </Text>
                {r.itemSummary ? (
                  <Text style={styles.rowItems} numberOfLines={1}>
                    {r.itemSummary}
                  </Text>
                ) : null}
              </Pressable>
              <View style={styles.rowRight}>
                <Text style={styles.total}>{money(r.total, "CAD")}</Text>
                {st === "active" ? (
                  <View style={styles.age}>
                    <Clock size={13} color={color.textDim} strokeWidth={2.25} />
                    <Text style={styles.ageTxt}>{formatElapsed(r.createdAt, now)}</Text>
                  </View>
                ) : null}
              </View>
              {st === "active" && canFulfill ? (
                <Button title="Mark ready" variant="success" onPress={() => fulfill(r.id, "ready")} loading={busyId === r.id} />
              ) : st === "completed" && canFulfill ? (
                <Button title="Reopen" variant="secondary" onPress={() => fulfill(r.id, "reopen")} loading={busyId === r.id} />
              ) : (
                <Pressable onPress={() => router.push({ pathname: "/history/[id]", params: { id: r.id } })} hitSlop={8} style={styles.detail} accessibilityRole="button" accessibilityLabel="Order details">
                  <ChevronRight size={20} color={color.textDim} strokeWidth={2.25} />
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  filters: { gap: space.sm },
  list: { padding: space.lg, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72 },
  rowMain: { flex: 1, gap: 2 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rowTitle: { flexShrink: 1, fontFamily: "Poppins_600SemiBold", fontSize: 17, color: color.text },
  rowSub: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  rowItems: { fontFamily: "Poppins_400Regular", fontSize: 14, color: color.textFaint },
  rowRight: { alignItems: "flex-end", gap: 2, minWidth: 92 },
  total: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text, textAlign: "right", fontVariant: ["tabular-nums"] },
  age: { flexDirection: "row", alignItems: "center", gap: 4 },
  ageTxt: { fontFamily: "Poppins_500Medium", fontSize: 13, color: color.textDim, fontVariant: ["tabular-nums"] },
  detail: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});
