import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { SegmentedTabs, KdsTicket, color, space, text } from "@/design";
import { useSession } from "@/state/session";
import { supabase } from "@/lib/supabase";
import { fetchKitchenTickets, fetchKitchenStations, fetchKdsAging, type KitchenTicket, type KitchenStation, type Aging } from "@/lib/reads";
import { kdsMutate } from "@/lib/api";
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
      /* transient */
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
    const channel = supabase
      .channel("kds-" + bizId)
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

  async function mutate(id: string, op: "bump" | "recall") {
    setBusyId(id);
    // Optimistic: bump removes from the open board; recall returns it.
    setTickets((ts) => ts.map((t) => (t.id === id ? { ...t, fulfilledAt: op === "bump" ? new Date(now || Date.now()).toISOString() : null } : t)));
    try {
      await kdsMutate(bizId, staffId, id, op);
    } catch {
      /* realtime/interval will re-sync on failure */
    } finally {
      setBusyId(null);
      load();
    }
  }

  const stationTabs = useMemo(() => [{ key: "all", label: "All" }, ...stations.map((x) => ({ key: x.id, label: x.name }))], [stations]);

  const inStation = (t: KitchenTicket) => station === "all" || t.stationId === station;

  const open = useMemo(
    () =>
      tickets
        .filter((t) => !t.fulfilledAt && inStation(t))
        .sort((a, b) => (a.rush === b.rush ? new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime() : a.rush ? -1 : 1)),
    [tickets, station, now]
  );
  const recent = useMemo(
    () => tickets.filter((t) => t.fulfilledAt && inStation(t)).sort((a, b) => new Date(b.fulfilledAt!).getTime() - new Date(a.fulfilledAt!).getTime()),
    [tickets, station]
  );
  const rushCount = open.filter((t) => t.rush).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.hl}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={text.bodyDim}>‹ Floor</Text>
          </Pressable>
          <Text style={styles.title}>Kitchen</Text>
          <Text style={text.caption}>
            {open.length} firing{rushCount > 0 ? " · " + rushCount + " rush" : ""}
          </Text>
        </View>
        {stationTabs.length > 1 && <SegmentedTabs tabs={stationTabs} value={station} onChange={setStation} />}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {open.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>Nothing firing.</Text>}
        {open.map((t) => (
          <KdsTicket
            key={t.id}
            label={t.label || "Ticket"}
            elapsedLabel={formatElapsed(t.firedAt, now)}
            agingColor={agingColor(t.firedAt, aging, now)}
            rush={t.rush}
            items={t.items}
            busy={busyId === t.id}
            onBump={() => mutate(t.id, "bump")}
          />
        ))}
      </ScrollView>

      {recent.length > 0 && (
        <View style={styles.recallStrip}>
          <Text style={styles.recallLabel}>Recently ready — tap to recall</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recallRow}>
            {recent.slice(0, 12).map((t) => (
              <Pressable key={t.id} onPress={() => mutate(t.id, "recall")} style={styles.recallChip}>
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
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm },
  hl: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  title: { fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.lg },
  recallStrip: { borderTopWidth: 1, borderTopColor: color.border, paddingVertical: space.sm, paddingHorizontal: space.lg, gap: space.xs },
  recallLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: color.textDim },
  recallRow: { gap: space.sm },
  recallChip: { backgroundColor: color.card2, borderRadius: 999, borderWidth: 1, borderColor: color.border, paddingHorizontal: space.md, paddingVertical: space.xs },
  recallChipTxt: { fontFamily: "Poppins_500Medium", fontSize: 12, color: color.textDim, maxWidth: 140 },
});
