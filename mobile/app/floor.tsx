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
  floor as F,
  space,
  text,
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
const DECOR = new Set(["wall", "room", "label", "counter", "station"]);
const TABLE_SCALE = 1.35; // large, tap-friendly tables
const PAD = 24;
const PLANK = 46; // wood plank spacing (screen px)

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

// Saturated fill per status (TB palette: navy vacant, magenta occupied).
function fillFor(status: TableStatus): string {
  switch (status) {
    case "occupied": return F.occupied;
    case "warning": return F.warning;
    case "late": return F.late;
    case "paid": return F.paid;
    default: return F.vacant;
  }
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

        const planName: Record<string, string> = Object.fromEntries(pl.map((p) => [p.id, p.name]));
        const secName: Record<string, string> = Object.fromEntries(secs.map((x) => [x.id, x.name]));
        const { data: allEls } = await supabase
          .from("floor_elements")
          .select("plan_id, section_id")
          .eq("business_id", bizId)
          .eq("is_active", true)
          .in("kind", ["table", "booth"]);
        const byPlan: Record<string, { count: number; sections: Set<string> }> = {};
        for (const e of allEls ?? []) {
          const p = (e.plan_id as string) ?? "none";
          const b = (byPlan[p] ||= { count: 0, sections: new Set() });
          b.count++;
          if (e.section_id) b.sections.add(secName[e.section_id as string] ?? (e.section_id as string));
        }
        for (const [pid, info] of Object.entries(byPlan)) {
          const secList = [...info.sections];
          console.log(`[floor] plan "${planName[pid] ?? pid}" — ${info.count} tables; sections: ${secList.join(", ") || "none"}`);
          if (secList.length > 1) {
            console.warn(`[floor] plan "${planName[pid] ?? pid}" hosts multiple sections (${secList.join(", ")}). Sections don't create Map tabs — split Patio/Bar into its own FLOOR PLAN in the web editor.`);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [bizId]);

  useEffect(() => {
    if (!activePlan) return;
    (async () => {
      try {
        const els = await fetchFloorElements(bizId, activePlan);
        const strict = els.filter((e) => e.planId === activePlan);
        if (strict.length !== els.length) console.warn(`[floor] dropped ${els.length - strict.length} element(s) not on the selected plan.`);
        setElements(strict);
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

  const tables = useMemo(() => elements.filter((e) => RINGABLE.has(e.kind)), [elements]);
  const decor = useMemo(() => elements.filter((e) => DECOR.has(e.kind)), [elements]);

  const seatCountByTable = useMemo(() => {
    const childCount: Record<string, number> = {};
    for (const e of elements) if (e.kind === "seat" && e.parentId) childCount[e.parentId] = (childCount[e.parentId] ?? 0) + 1;
    const m: Record<string, number> = {};
    for (const t of tables) m[t.id] = Math.max(1, Math.min(20, childCount[t.id] || summaries[t.id]?.guests || 4));
    return m;
  }, [elements, tables, summaries]);

  const bbox = useMemo(() => {
    if (elements.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x0: number, y0: number, x1: number, y1: number) => {
      minX = Math.min(minX, x0);
      minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1);
      maxY = Math.max(maxY, y1);
    };
    for (const t of tables) {
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      grow(cx - (t.w * TABLE_SCALE) / 2, cy - (t.h * TABLE_SCALE) / 2, cx + (t.w * TABLE_SCALE) / 2, cy + (t.h * TABLE_SCALE) / 2);
    }
    for (const d of decor) grow(d.x, d.y, d.x + d.w, d.y + d.h);
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [elements, tables, decor]);

  const canvasW = bbox ? bbox.maxX - bbox.minX + 2 * PAD : 200;
  const canvasH = bbox ? bbox.maxY - bbox.minY + 2 * PAD : 200;
  const ox = bbox ? PAD - bbox.minX : PAD;
  const oy = bbox ? PAD - bbox.minY : PAD;
  const scale = size.w > 0 && size.h > 0 ? Math.min(size.w / canvasW, size.h / canvasH) : 1;

  const statusById = useMemo(() => {
    const m: Record<string, TableStatus> = {};
    for (const t of tables) m[t.id] = tableStatus(summaries[t.id], aging, now);
    return m;
  }, [tables, summaries, aging, now]);

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
      color: sectionColor[sid] ?? "#00000018",
      x: z.minX + ox - 18,
      y: z.minY + oy - 18,
      w: z.maxX - z.minX + 36,
      h: z.maxY - z.minY + 36,
    }));
  }, [elements, ox, oy, sectionColor, sectionName]);

  const planks = useMemo(() => {
    const n = size.h > 0 ? Math.ceil(size.h / PLANK) : 0;
    return Array.from({ length: n }, (_, i) => i * PLANK);
  }, [size.h]);

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
          {/* Full-bleed warm-wood floor */}
          <View style={styles.floor} onLayout={onCanvasLayout}>
            {planks.map((top) => (
              <View key={top} style={[styles.plank, { top }]} pointerEvents="none" />
            ))}
            {elements.length === 0 ? (
              <Text style={styles.emptyTxt}>No floor plan for this room. Design it in the web app.</Text>
            ) : (
              <View style={{ width: canvasW, height: canvasH, transform: [{ scale }] }}>
                {zones.map((z) => (
                  <View key={z.id} style={{ position: "absolute", left: z.x, top: z.y, width: z.w, height: z.h, borderRadius: 22, backgroundColor: z.color + "22", borderWidth: 1, borderColor: z.color + "44" }}>
                    {z.name ? <Text style={[styles.zoneLabel, { color: z.color }]}>{z.name}</Text> : null}
                  </View>
                ))}
                {decor.map((el) => (
                  <TableShape key={el.id} x={el.x + ox} y={el.y + oy} w={el.w} h={el.h} rotation={el.rotation} shape={el.shape} kind={el.kind} label={el.label} />
                ))}
                {tables.map((t) => {
                  const summary = summaries[t.id];
                  const st = statusById[t.id] ?? "available";
                  const occupied = st !== "available";
                  const tw = t.w * TABLE_SCALE, th = t.h * TABLE_SCALE;
                  const tx = t.x + t.w / 2 - tw / 2 + ox;
                  const ty = t.y + t.h / 2 - th / 2 + oy;
                  return (
                    <TableShape
                      key={t.id}
                      x={tx}
                      y={ty}
                      w={tw}
                      h={th}
                      rotation={t.rotation}
                      shape={t.shape}
                      kind={t.kind}
                      fill={fillFor(st)}
                      label={t.label}
                      occupied={occupied}
                      seats={seatCountByTable[t.id]}
                      covers={summary?.guests ?? null}
                      timer={summary ? (summary.checkDropped ? "dropped" : formatElapsed(summary.openedAt, now)) : null}
                      total={summary && summary.subtotal > 0 ? money(summary.subtotal, "CAD") : null}
                      onPress={() => openTable(t, summary)}
                    />
                  );
                })}
              </View>
            )}
          </View>
          <View style={styles.legend}>
            {LEGEND.map((l) => (
              <View key={l.status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: fillFor(l.status) }]} />
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
  controls: { paddingHorizontal: space.xl, gap: space.sm, paddingBottom: space.sm },
  floor: { flex: 1, backgroundColor: F.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  plank: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: F.plank },
  emptyTxt: { color: "#6E665A", fontSize: 15, textAlign: "center" },
  zoneLabel: { position: "absolute", left: 12, bottom: 8, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  legend: { flexDirection: "row", justifyContent: "center", gap: space.lg, paddingVertical: space.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
  signout: { alignItems: "center", padding: space.sm },
});
