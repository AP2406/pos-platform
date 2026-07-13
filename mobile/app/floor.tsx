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
  type FloorSection,
  type TableSummary,
  type OpenCheck,
  type Aging,
} from "@/lib/reads";
import { formatElapsed, minutesSince, money } from "@/lib/format";

const RINGABLE = new Set(["table", "booth"]);
const LEGEND: { status: TableStatus; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "occupied", label: "Occupied" },
  { status: "warning", label: "Warning" },
  { status: "late", label: "Late" },
];

function tableStatus(summary: TableSummary | undefined, aging: Aging, now: number): TableStatus {
  if (!summary) return "available";
  if (summary.checkDropped) return "paid";
  const m = minutesSince(summary.openedAt, now) ?? 0;
  if (summary.itemCount <= 0 || summary.subtotal <= 0) return "occupied";
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
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [summaries, setSummaries] = useState<Record<string, TableSummary>>({});
  const [aging, setAging] = useState<Aging>({ yellowMin: 60, redMin: 90 });
  const [openChecks, setOpenChecks] = useState<OpenCheck[]>([]);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [pl, secs, ag] = await Promise.all([fetchFloorPlans(bizId), fetchSections(bizId), fetchTableAging(bizId)]);
        setPlans(pl);
        setActivePlan((cur) => cur ?? pl[0]?.id ?? null);
        setSections(secs);
        setAging(ag);
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

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

  const sectionColor = useMemo(() => Object.fromEntries(sections.filter((x) => x.color).map((x) => [x.id, x.color as string])), [sections]);
  const sectionName = useMemo(() => Object.fromEntries(sections.map((x) => [x.id, x.name])), [sections]);

  // Centre on the CONTENT bounding box (not the 0,0 canvas) so tables sit
  // centred with even padding instead of clustered top-left.
  const bbox = useMemo(() => {
    if (elements.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of elements) {
      minX = Math.min(minX, e.x);
      minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + e.w);
      maxY = Math.max(maxY, e.y + e.h);
    }
    return { minX, minY, maxX, maxY };
  }, [elements]);

  const P = 28;
  const canvasW = bbox ? bbox.maxX - bbox.minX + 2 * P : 200;
  const canvasH = bbox ? bbox.maxY - bbox.minY + 2 * P : 200;
  const ox = bbox ? P - bbox.minX : P;
  const oy = bbox ? P - bbox.minY : P;
  const scale = size.w > 0 && size.h > 0 ? Math.min(size.w / canvasW, size.h / canvasH) : 1;

  const statusById = useMemo(() => {
    const m: Record<string, TableStatus> = {};
    for (const e of elements) if (RINGABLE.has(e.kind)) m[e.id] = tableStatus(summaries[e.id], aging, now);
    return m;
  }, [elements, summaries, aging, now]);

  const zones = useMemo(() => {
    const byId: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {};
    for (const e of elements) {
      if (!e.sectionId) continue;
      const z = (byId[e.sectionId] ||= { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
      z.minX = Math.min(z.minX, e.x);
      z.minY = Math.min(z.minY, e.y);
      z.maxX = Math.max(z.maxX, e.x + e.w);
      z.maxY = Math.max(z.maxY, e.y + e.h);
    }
    return Object.entries(byId).map(([sid, z]) => ({
      id: sid,
      name: sectionName[sid] ?? "",
      color: sectionColor[sid] ?? color.textFaint,
      x: z.minX + ox - 14,
      y: z.minY + oy - 14,
      w: z.maxX - z.minX + 28,
      h: z.maxY - z.minY + 28,
    }));
  }, [elements, ox, oy, sectionColor, sectionName]);

  function onCanvasLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  function openTable(el: FloorElement, summary: TableSummary | undefined) {
    if (summary) router.push({ pathname: "/register", params: { ticket: summary.ticketId } });
    else router.push({ pathname: "/register", params: { table: el.label ?? "" } });
  }

  function seatTint(parentId: string | null): string {
    const st = parentId ? statusById[parentId] : undefined;
    return st && st !== "available" ? tableStatusColor(st) + "26" : color.card2;
  }

  const listVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openChecks.filter((c) => !q || c.label.toLowerCase().includes(q) || (c.customerPhone ?? "").toLowerCase().includes(q));
  }, [openChecks, query]);

  const planTabs = plans.map((p) => ({ key: p.id, label: p.name }));
  const nonTable = elements.filter((e) => !RINGABLE.has(e.kind));
  const tables = elements.filter((e) => RINGABLE.has(e.kind));

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
              <View style={[styles.floor, { width: canvasW, height: canvasH, transform: [{ scale }] }]}>
                {/* Section zones (behind everything) */}
                {zones.map((z) => (
                  <View key={z.id} style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, borderRadius: 18, backgroundColor: z.color + "14", borderWidth: 1, borderColor: z.color + "33" }}>
                    {z.name ? <Text style={[styles.zoneLabel, { color: z.color }]}>{z.name}</Text> : null}
                  </View>
                ))}
                {/* Décor, fixtures, chairs (behind tables) */}
                {nonTable.map((el) => (
                  <TableShape key={el.id} x={el.x + ox} y={el.y + oy} w={el.w} h={el.h} rotation={el.rotation} shape={el.shape} kind={el.kind} label={el.label} seatTint={seatTint(el.parentId)} />
                ))}
                {/* Tables on top */}
                {tables.map((el) => {
                  const summary = summaries[el.id];
                  const st = statusById[el.id] ?? "available";
                  const c = tableStatusColor(st);
                  const fill = st === "available" ? color.card : c + "1F";
                  return (
                    <TableShape
                      key={el.id}
                      x={el.x + ox}
                      y={el.y + oy}
                      w={el.w}
                      h={el.h}
                      rotation={el.rotation}
                      shape={el.shape}
                      kind={el.kind}
                      statusColor={c}
                      fillColor={fill}
                      sectionColor={el.sectionId ? sectionColor[el.sectionId] : null}
                      label={el.label}
                      total={summary && summary.subtotal > 0 ? money(summary.subtotal, "CAD") : null}
                      guests={summary?.guests ?? null}
                      timeLabel={summary ? (summary.checkDropped ? "dropped" : formatElapsed(summary.openedAt, now)) : null}
                      onPress={() => openTable(el, summary)}
                    />
                  );
                })}
              </View>
            )}
          </View>
          <View style={styles.legend}>
            {LEGEND.map((l) => (
              <View key={l.status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: tableStatusColor(l.status) }]} />
                <Text style={text.caption}>{l.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.controls}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Find a check — name or phone" />
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {listVisible.length === 0 && <Text style={[text.bodyDim, { padding: space.lg }]}>No open checks.</Text>}
            {listVisible.map((c) => (
              <TableCard
                key={c.id}
                label={c.label}
                sub={c.guests > 0 ? c.guests + " guests" : c.channel ?? c.ticketType ?? undefined}
                minutes={minutesSince(c.openedAt, now)}
                elapsedLabel={c.checkDropped ? "check dropped" : formatElapsed(c.openedAt, now)}
                checkDropped={c.checkDropped}
                onPress={() => router.push({ pathname: "/register", params: { ticket: c.id } })}
              />
            ))}
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
  floor: { backgroundColor: color.card, borderRadius: 20, borderWidth: 1, borderColor: color.border },
  zoneLabel: { position: "absolute", left: 10, bottom: 6, fontFamily: "Poppins_500Medium", fontSize: 11 },
  legend: { flexDirection: "row", justifyContent: "center", gap: space.lg, paddingBottom: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
  signout: { alignItems: "center", padding: space.sm },
});
