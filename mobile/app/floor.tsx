import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  SegmentedTabs,
  SearchField,
  TableCard,
  TableShape,
  Button,
  color,
  space,
  text,
  tableStatusColor,
  type TableStatus,
} from "@/design";
import { useSession } from "@/state/session";
import { supabase } from "@/lib/supabase";
import {
  fetchFloorPlans,
  fetchFloorElements,
  fetchSections,
  fetchTableSummaries,
  fetchTableAging,
  fetchOpenChecks,
  type FloorPlan,
  type FloorElement,
  type TableSummary,
  type OpenCheck,
  type Aging,
} from "@/lib/reads";
import { formatElapsed, minutesSince, money } from "@/lib/format";

const RINGABLE = new Set(["table", "booth"]);

function tableStatus(summary: TableSummary | undefined, aging: Aging, now: number): TableStatus {
  if (!summary) return "available";
  if (summary.checkDropped) return "paid";
  const m = minutesSince(summary.openedAt, now) ?? 0;
  if (summary.itemCount <= 0 || summary.subtotal <= 0) return "occupied"; // seated, no order yet
  if (m >= aging.redMin) return "late";
  if (m >= aging.yellowMin) return "warning";
  return "occupied";
}

export default function Floor() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;

  const [view, setView] = useState<"map" | "list">("map");
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [elements, setElements] = useState<FloorElement[]>([]);
  const [sectionColor, setSectionColor] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, TableSummary>>({});
  const [aging, setAging] = useState<Aging>({ yellowMin: 60, redMin: 90 });
  const [openChecks, setOpenChecks] = useState<OpenCheck[]>([]);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Static-ish layout (plans, sections, aging) once.
  useEffect(() => {
    (async () => {
      try {
        const [pl, secs, ag] = await Promise.all([fetchFloorPlans(bizId), fetchSections(bizId), fetchTableAging(bizId)]);
        setPlans(pl);
        setActivePlan((cur) => cur ?? pl[0]?.id ?? null);
        const cmap: Record<string, string> = {};
        for (const sec of secs) if (sec.color) cmap[sec.id] = sec.color;
        setSectionColor(cmap);
        setAging(ag);
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

  // Elements for the active plan.
  useEffect(() => {
    if (!activePlan) return;
    (async () => {
      try {
        setElements(await fetchFloorElements(bizId, activePlan));
      } catch {
        /* ignore */
      }
    })();
  }, [bizId, activePlan]);

  // Live check state (summaries + list), realtime + 30s tick.
  const loadLive = useCallback(async () => {
    try {
      const [sum, checks] = await Promise.all([fetchTableSummaries(bizId), fetchOpenChecks(bizId)]);
      setSummaries(sum);
      setOpenChecks(checks);
    } catch {
      /* ignore */
    }
  }, [bizId]);

  useEffect(() => {
    setNow(Date.now());
    loadLive();
    const channel = supabase
      .channel("floor-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + bizId }, () => loadLive())
      .subscribe();
    const iv = setInterval(() => {
      setNow(Date.now());
      loadLive();
    }, 30000);
    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [bizId, loadLive]);

  // Canvas bounds + fit-to-container scale (mirrors the web floor).
  const { canvasW, canvasH } = useMemo(() => {
    let w = 200;
    let h = 200;
    for (const e of elements) {
      w = Math.max(w, e.x + e.w + 40);
      h = Math.max(h, e.y + e.h + 40);
    }
    return { canvasW: w, canvasH: h };
  }, [elements]);
  const scale = size.w > 0 && size.h > 0 ? Math.min(size.w / canvasW, size.h / canvasH) : 1;

  function onCanvasLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  function openTable(el: FloorElement, summary: TableSummary | undefined) {
    if (summary) router.push({ pathname: "/register", params: { ticket: summary.ticketId } });
    else router.push({ pathname: "/register", params: { table: el.label ?? "" } });
  }

  const listVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openChecks.filter((c) => !q || c.label.toLowerCase().includes(q) || (c.customerPhone ?? "").toLowerCase().includes(q));
  }, [openChecks, query]);

  const planTabs = plans.map((p) => ({ key: p.id, label: p.name }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={text.title}>Floor</Text>
          <Text style={text.caption}>
            {s.businessName} · {s.staff?.name}
          </Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.toggle}>
            <Pressable onPress={() => setView("map")} style={[styles.toggleBtn, view === "map" && styles.toggleOn]}>
              <Text style={[text.caption, view === "map" && { color: color.text }]}>Map</Text>
            </Pressable>
            <Pressable onPress={() => setView("list")} style={[styles.toggleBtn, view === "list" && styles.toggleOn]}>
              <Text style={[text.caption, view === "list" && { color: color.text }]}>List</Text>
            </Pressable>
          </View>
          <Button title="New tab" variant="secondary" onPress={() => router.push("/register?mode=tab")} />
          <Button title="New to-go" onPress={() => router.push("/register?mode=togo")} />
        </View>
      </View>

      {view === "map" ? (
        <>
          {planTabs.length > 1 && (
            <View style={styles.controls}>
              <SegmentedTabs tabs={planTabs} value={activePlan ?? ""} onChange={(k) => setActivePlan(k)} />
            </View>
          )}
          <View style={styles.canvasWrap} onLayout={onCanvasLayout}>
            {elements.length === 0 ? (
              <Text style={[text.bodyDim, { textAlign: "center" }]}>No floor plan for this room. Design it in the web app.</Text>
            ) : (
              <View style={{ width: canvasW, height: canvasH, transform: [{ scale }] }}>
                {elements.map((el) => {
                  const isTable = RINGABLE.has(el.kind);
                  const summary = isTable ? summaries[el.id] : undefined;
                  const status = tableStatus(summary, aging, now);
                  const meta = summary
                    ? (summary.guests > 0 ? summary.guests + "p · " : "") + (summary.checkDropped ? "dropped" : formatElapsed(summary.openedAt, now))
                    : null;
                  return (
                    <TableShape
                      key={el.id}
                      x={el.x}
                      y={el.y}
                      w={el.w}
                      h={el.h}
                      rotation={el.rotation}
                      shape={el.shape}
                      kind={el.kind}
                      statusColor={isTable ? tableStatusColor(status) : undefined}
                      sectionColor={el.sectionId ? sectionColor[el.sectionId] : null}
                      label={el.label}
                      total={summary && summary.subtotal > 0 ? money(summary.subtotal, "CAD") : null}
                      meta={meta}
                      onPress={isTable ? () => openTable(el, summary) : undefined}
                    />
                  );
                })}
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={styles.controls}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Find a check — name or phone" />
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {listVisible.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>No open checks.</Text>}
            {listVisible.map((c) => {
              const mins = minutesSince(c.openedAt, now);
              return (
                <TableCard
                  key={c.id}
                  label={c.label}
                  sub={c.guests > 0 ? c.guests + " guests" : c.channel ?? c.ticketType ?? undefined}
                  minutes={mins}
                  elapsedLabel={c.checkDropped ? "check dropped" : formatElapsed(c.openedAt, now)}
                  checkDropped={c.checkDropped}
                  onPress={() => router.push({ pathname: "/register", params: { ticket: c.id } })}
                />
              );
            })}
          </ScrollView>
        </>
      )}

      <Pressable onPress={s.signOut} style={styles.signout}>
        <Text style={text.caption}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.xl, paddingBottom: space.md },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  toggle: { flexDirection: "row", backgroundColor: color.card, borderRadius: 999, padding: 2, borderWidth: 1, borderColor: color.border },
  toggleBtn: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 999 },
  toggleOn: { backgroundColor: color.card2 },
  controls: { paddingHorizontal: space.xl, gap: space.sm },
  canvasWrap: { flex: 1, margin: space.lg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
  signout: { alignItems: "center", padding: space.md },
});
