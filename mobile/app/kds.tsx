import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChefHat, CircleCheck } from "lucide-react-native";
import { SegmentedTabs, KdsTicket, ScreenHeader, EmptyState, color, space, radius, aging as agingColors, AGING_LABEL } from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchKitchenTickets, fetchKitchenStations, fetchKdsAging, type KitchenTicket, type KitchenStation, type KdsItem, type Aging } from "@/lib/reads";
import { kdsMutate } from "@/lib/api";
import { canBumpKds } from "@/lib/access";
import { formatElapsed, minutesSince } from "@/lib/format";

type Tier = "normal" | "warning" | "late";
function tierOf(firedAt: string, aging: Aging, now: number): Tier {
  const m = minutesSince(firedAt, now) ?? 0;
  if (m >= aging.redMin) return "late";
  if (m >= aging.yellowMin) return "warning";
  return "normal";
}
const TIER_COLOR: Record<Tier, string> = { normal: color.success, warning: agingColors.warning, late: agingColors.late };

export default function Kds() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  const hasFloor = (s.access?.surfaces ?? []).includes("floor");
  const canBump = canBumpKds(s.staff?.role ?? "", s.deviceHome); // servers get a read-only glance

  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [aging, setAging] = useState<Aging>({ yellowMin: 10, redMin: 18 });
  const [station, setStation] = useState<string>("all");
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await fetchKitchenTickets(bizId));
    } catch {
      notify("Couldn't load the latest — check your connection.");
    } finally {
      setLoaded(true);
    }
  }, [bizId]);

  useEffect(() => {
    (async () => {
      try {
        const [st, ag] = await Promise.all([fetchKitchenStations(bizId), fetchKdsAging(bizId)]);
        setStations(st);
        setAging(ag);
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

  useEffect(() => {
    setNow(Date.now());
    load();
    const channel = realtimeChannel("kds-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets", filter: "business_id=eq." + bizId }, () => load())
      .subscribe();
    const iv = setInterval(() => {
      setNow(Date.now());
      load();
    }, 15000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [bizId, load]);

  // Bump/recall a whole table's group of (station-split) tickets at once.
  async function mutate(ids: string[], op: "bump" | "recall") {
    if (!canBump || ids.length === 0) return; // read-only glance
    setBusyId(ids[0]);
    const set = new Set(ids);
    setTickets((ts) => ts.map((t) => (set.has(t.id) ? { ...t, fulfilledAt: op === "bump" ? new Date(now || Date.now()).toISOString() : null } : t)));
    try {
      await Promise.all(ids.map((id) => kdsMutate(bizId, staffId, id, op)));
    } catch {
      /* realtime/interval will re-sync on failure */
    } finally {
      setBusyId(null);
      load();
    }
  }

  const stationTabs = useMemo(() => [{ key: "all", label: "All stations" }, ...stations.map((x) => ({ key: x.id, label: x.name }))], [stations]);

  const inStation = (t: KitchenTicket) => station === "all" || t.stationId === station;

  // ONE card per table: the kitchen splits a fired order into a ticket per station,
  // so merge a table's tickets back into a single card (all items). Grouped by the
  // table (element_id) or, for non-table tickets, the base label; void notices stay
  // separate.
  type KdsCard = { key: string; label: string; items: KdsItem[]; firedAt: string; fulfilledAt: string | null; rush: boolean; ids: string[] };
  function group(list: KitchenTicket[]): KdsCard[] {
    const groups = new Map<string, KdsCard>();
    for (const t of list) {
      // Table tickets merge by table; off-premise tickets merge by their full
      // label ("Takeout · Maya R.") so the guest's name stays on the card.
      const full = (t.label ?? "Ticket").trim() || "Ticket";
      const base = full.split(" · ")[0].trim() || "Ticket";
      const isVoid = full.toUpperCase().startsWith("VOID");
      const key = (isVoid ? t.id : t.elementId ?? "lbl:" + full) + (t.fulfilledAt ? ":done" : "");
      const g = groups.get(key);
      if (!g) groups.set(key, { key, label: t.elementId ? base : full, items: [...t.items], firedAt: t.firedAt, fulfilledAt: t.fulfilledAt, rush: t.rush, ids: [t.id] });
      else {
        g.items.push(...t.items);
        g.rush = g.rush || t.rush;
        if (new Date(t.firedAt).getTime() < new Date(g.firedAt).getTime()) g.firedAt = t.firedAt;
        if (t.fulfilledAt && (!g.fulfilledAt || new Date(t.fulfilledAt).getTime() > new Date(g.fulfilledAt).getTime())) g.fulfilledAt = t.fulfilledAt;
        g.ids.push(t.id);
      }
    }
    return [...groups.values()];
  }

  const cooking = useMemo<KdsCard[]>(
    () => group(tickets.filter((t) => !t.fulfilledAt && inStation(t))).sort((a, b) => (a.rush === b.rush ? new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime() : a.rush ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, station]
  );
  const ready = useMemo<KdsCard[]>(
    () => group(tickets.filter((t) => !!t.fulfilledAt && inStation(t))).sort((a, b) => new Date(b.fulfilledAt!).getTime() - new Date(a.fulfilledAt!).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, station]
  );

  const lateCount = cooking.filter((c) => tierOf(c.firedAt, aging, now) === "late").length;
  const rushCount = cooking.filter((c) => c.rush).length;
  const subtitle = [cooking.length + " in progress", lateCount > 0 ? lateCount + " late" : null, rushCount > 0 ? rushCount + " rush" : null].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader title="Kitchen" subtitle={subtitle} onBack={hasFloor ? () => router.replace("/floor") : undefined} onSignOut={hasFloor ? undefined : s.signOut}>
        {stationTabs.length > 1 && <SegmentedTabs tabs={stationTabs} value={station} onChange={setStation} />}
      </ScreenHeader>

      <View style={styles.board}>
        {/* In progress */}
        <View style={styles.column}>
          <View style={styles.colHead}>
            <ChefHat size={18} color={color.text} strokeWidth={2.25} />
            <Text style={styles.colTitle}>In progress</Text>
            <View style={styles.count}>
              <Text style={styles.countTxt}>{cooking.length}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.colHint}>
              Amber after {aging.yellowMin} min · {AGING_LABEL.late} after {aging.redMin} min
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {loaded && cooking.length === 0 && (
              <EmptyState icon={<ChefHat size={26} color={color.textDim} strokeWidth={2} />} title="Nothing in the kitchen" body="Orders sent from the register appear here the moment they're fired, oldest first." />
            )}
            {cooking.map((c) => {
              const tier = tierOf(c.firedAt, aging, now);
              return (
                <KdsTicket
                  key={c.key}
                  label={c.label}
                  elapsedLabel={formatElapsed(c.firedAt, now)}
                  agingColor={TIER_COLOR[tier]}
                  agingLabel={tier === "normal" ? null : AGING_LABEL[tier]}
                  rush={c.rush}
                  items={c.items}
                  busy={busyId === c.ids[0]}
                  readOnly={!canBump}
                  onBump={() => mutate(c.ids, "bump")}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Ready */}
        <View style={[styles.column, styles.readyCol]}>
          <View style={styles.colHead}>
            <CircleCheck size={18} color={color.success} strokeWidth={2.25} />
            <Text style={styles.colTitle}>Ready</Text>
            <View style={[styles.count, { backgroundColor: color.successSoft }]}>
              <Text style={[styles.countTxt, { color: color.success }]}>{ready.length}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.readyList}>
            {loaded && ready.length === 0 && <EmptyState compact title="Nothing waiting for pickup" body={canBump ? "Tickets you mark ready stay here for 30 minutes so you can recall one." : "Tickets the kitchen marks ready show here."} />}
            {ready.map((c) => (
              <KdsTicket
                key={c.key}
                label={c.label}
                elapsedLabel={"ready " + formatElapsed(c.fulfilledAt, now)}
                agingColor={color.success}
                fulfilled
                items={c.items}
                busy={busyId === c.ids[0]}
                readOnly={!canBump}
                onRecall={() => mutate(c.ids, "recall")}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  board: { flex: 1, flexDirection: "row" },
  column: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xs },
  readyCol: { flex: 0, width: 300, borderLeftWidth: 1, borderLeftColor: color.border, backgroundColor: color.card },
  colHead: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingBottom: space.sm },
  colTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: color.text },
  colHint: { fontFamily: "Poppins_400Regular", fontSize: 13, color: color.textFaint },
  count: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: color.card2 },
  countTxt: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: color.text, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, paddingBottom: space.xl },
  readyList: { gap: space.md, paddingBottom: space.xl },
});
