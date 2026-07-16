import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SegmentedTabs, KdsTicket, ScreenHeader, EmptyState, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { supabase, realtimeChannel } from "@/lib/supabase";
import { fetchKitchenTickets, fetchKitchenStations, fetchKdsAging, type KitchenTicket, type KitchenStation, type KdsItem, type Aging } from "@/lib/reads";
import { kdsMutate } from "@/lib/api";
import { canBumpKds } from "@/lib/access";
import { formatElapsed, minutesSince } from "@/lib/format";

function agingColor(firedAt: string, aging: Aging, now: number): string {
  const m = minutesSince(firedAt, now) ?? 0;
  if (m >= aging.redMin) return "#E5484D";
  if (m >= aging.yellowMin) return "#F5A623";
  return "#2FBF71";
}

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

  const load = useCallback(async () => {
    try {
      setTickets(await fetchKitchenTickets(bizId));
    } catch {
      notify("Couldn't load the latest — check your connection.");
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

  const stationTabs = useMemo(() => [{ key: "all", label: "All" }, ...stations.map((x) => ({ key: x.id, label: x.name }))], [stations]);

  const inStation = (t: KitchenTicket) => station === "all" || t.stationId === station;

  // ONE card per table: the kitchen splits a fired order into a ticket per station,
  // so merge a table's tickets back into a single card (all items). Grouped by the
  // table (element_id) or, for non-table tickets, the base label; void notices stay
  // separate.
  type KdsCard = { key: string; label: string; items: KdsItem[]; firedAt: string; rush: boolean; ids: string[] };
  const cards = useMemo<KdsCard[]>(() => {
    const groups = new Map<string, KdsCard>();
    for (const t of tickets) {
      if (t.fulfilledAt || !inStation(t)) continue;
      const base = (t.label ?? "Ticket").split(" · ")[0].trim() || "Ticket";
      const isVoid = (t.label ?? "").toUpperCase().startsWith("VOID");
      const key = isVoid ? t.id : t.elementId ?? "lbl:" + base;
      const g = groups.get(key);
      if (!g) groups.set(key, { key, label: isVoid ? t.label ?? base : base, items: [...t.items], firedAt: t.firedAt, rush: t.rush, ids: [t.id] });
      else {
        g.items.push(...t.items);
        g.rush = g.rush || t.rush;
        if (new Date(t.firedAt).getTime() < new Date(g.firedAt).getTime()) g.firedAt = t.firedAt;
        g.ids.push(t.id);
      }
    }
    return [...groups.values()].sort((a, b) => (a.rush === b.rush ? new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime() : a.rush ? -1 : 1));
  }, [tickets, station, now]);

  const recent = useMemo(
    () => tickets.filter((t) => t.fulfilledAt && inStation(t)).sort((a, b) => new Date(b.fulfilledAt!).getTime() - new Date(a.fulfilledAt!).getTime()),
    [tickets, station]
  );
  const rushCount = cards.filter((c) => c.rush).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Kitchen"
        subtitle={cards.length + " firing" + (rushCount > 0 ? " · " + rushCount + " rush" : "")}
        onBack={hasFloor ? () => router.replace("/floor") : undefined}
        onSignOut={hasFloor ? undefined : s.signOut}
      >
        {stationTabs.length > 1 && <SegmentedTabs tabs={stationTabs} value={station} onChange={setStation} />}
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.grid}>
        {cards.length === 0 && <EmptyState>Nothing firing.</EmptyState>}
        {cards.map((c) => (
          <KdsTicket
            key={c.key}
            label={c.label}
            elapsedLabel={formatElapsed(c.firedAt, now)}
            agingColor={agingColor(c.firedAt, aging, now)}
            rush={c.rush}
            items={c.items}
            busy={busyId === c.ids[0]}
            readOnly={!canBump}
            onBump={() => mutate(c.ids, "bump")}
          />
        ))}
      </ScrollView>

      {canBump && recent.length > 0 && (
        <View style={styles.recallStrip}>
          <Text style={styles.recallLabel}>Recently ready — tap to recall</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recallRow}>
            {recent.slice(0, 12).map((t) => (
              <Pressable key={t.id} onPress={() => mutate([t.id], "recall")} style={styles.recallChip}>
                <Text style={styles.recallChipTxt} numberOfLines={1}>
                  {t.label || "Ticket"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.lg },
  recallStrip: { borderTopWidth: 1, borderTopColor: color.border, paddingVertical: space.sm, paddingHorizontal: space.lg, gap: space.xs },
  recallLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: color.textDim },
  recallRow: { gap: space.sm },
  recallChip: { backgroundColor: color.card2, borderRadius: 999, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.xs },
  recallChipTxt: { fontFamily: "Poppins_500Medium", fontSize: 12, color: color.textDim, maxWidth: 140 },
});
