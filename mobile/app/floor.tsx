import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  SegmentedTabs,
  SearchField,
  TableCard,
  TableShape,
  Button,
  BottomSheet,
  color,
  floor as F,
  space,
  text,
  type TableStatus,
} from "@/design";
import { useSession } from "@/state/session";
import { supabase, realtimeChannel } from "@/lib/supabase";
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
import { seesAllTables } from "@/lib/access";

const RINGABLE = new Set(["table", "booth"]);
const DECOR = new Set(["wall", "room", "label", "counter", "station"]);
const TSIZE = 82; // fixed on-screen table size (longest side, px)
const STOOL = 22; // fixed on-screen stool size (px)
const MARGIN = 48; // small border so edge tables don't clip (~half a table)

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

// Bold, saturated table fill by status (purple available, warm-red occupied/late).
function statusFill(status: TableStatus): string {
  switch (status) {
    case "occupied": return F.statusOccupied;
    case "warning": return F.statusWarning;
    case "late": return F.statusLate;
    case "paid": return F.statusPaid;
    default: return F.statusAvailable;
  }
}

export default function Floor() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  // Servers see only tables they own; managers/owners see everything.
  const scoped = !seesAllTables(s.staff?.role ?? "");

  const [view, setView] = useState<"map" | "list">("map");
  const [moreOpen, setMoreOpen] = useState(false);
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
    const channel = realtimeChannel("floor-" + bizId)
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
  const kindById = useMemo(() => Object.fromEntries(elements.map((e) => [e.id, e.kind] as const)), [elements]);
  // Bar stools = seat elements parented to a counter/station (drawn at their real
  // positions along the bar). Table chairs stay hidden (tables show "N Seats").
  const stools = useMemo(
    () => elements.filter((e) => e.kind === "seat" && e.parentId && (kindById[e.parentId] === "counter" || kindById[e.parentId] === "station")),
    [elements, kindById]
  );
  // Fill: explicit section color from the data when set, else the bold status color.
  const fillForTable = (t: FloorElement, status: TableStatus) =>
    t.sectionId && sectionColor[t.sectionId] ? sectionColor[t.sectionId] : statusFill(status);

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
    // Fit is driven by table CENTERS (+ décor / stools), since tables render at a
    // fixed size decoupled from the fit.
    for (const t of tables) {
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      grow(cx, cy, cx, cy);
    }
    for (const d of decor) grow(d.x, d.y, d.x + d.w, d.y + d.h);
    for (const st of stools) grow(st.x, st.y, st.x + st.w, st.y + st.h);
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }, [elements, tables, decor, stools]);

  // Stretch the layout to fill the whole screen on BOTH axes (independent X/Y fit),
  // so the floor plan uses the full width AND height. Tables keep a fixed size
  // (undistorted) — only their positions spread; décor/zones stretch with the room.
  const roomW = bbox ? Math.max(1, bbox.maxX - bbox.minX) : 1;
  const roomH = bbox ? Math.max(1, bbox.maxY - bbox.minY) : 1;
  const Sx = size.w > 0 && bbox ? (size.w - 2 * MARGIN) / roomW : 1;
  const Sy = size.h > 0 && bbox ? (size.h - 2 * MARGIN) / roomH : 1;
  const offX = bbox ? MARGIN - bbox.minX * Sx : 0;
  const offY = bbox ? MARGIN - bbox.minY * Sy : 0;
  const sx = (x: number) => x * Sx + offX;
  const sy = (y: number) => y * Sy + offY;

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
      minX: z.minX,
      minY: z.minY,
      maxX: z.maxX,
      maxY: z.maxY,
    }));
  }, [elements, sectionColor, sectionName]);

  function onCanvasLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  function openTable(el: FloorElement, summary: TableSummary | undefined) {
    if (summary) router.push({ pathname: "/register", params: { ticket: summary.ticketId } });
    else router.push({ pathname: "/register", params: { table: el.label ?? "", element: el.id } });
  }

  const listVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openChecks
      .filter((c) => !scoped || c.staffId === staffId)
      .filter((c) => !q || c.label.toLowerCase().includes(q) || (c.customerPhone ?? "").toLowerCase().includes(q));
  }, [openChecks, query, scoped, staffId]);

  const planTabs = plans.map((p) => ({ key: p.id, label: p.name }));
  const activeBg = plans.find((p) => p.id === activePlan)?.background ?? null;
  const colorBg = activeBg?.type === "color" ? activeBg.value : null;
  const imageBg = activeBg?.type === "image" ? activeBg.value : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Floor <Text style={styles.headerSub}>· {s.businessName} · {s.staff?.name}</Text>
        </Text>
        <View style={styles.actions}>
          <View style={styles.toggle}>
            <Pressable onPress={() => setView("map")} style={[styles.toggleBtn, view === "map" && styles.toggleOn]}>
              <Text style={[text.caption, view === "map" && { color: color.text }]}>Map</Text>
            </Pressable>
            <Pressable onPress={() => setView("list")} style={[styles.toggleBtn, view === "list" && styles.toggleOn]}>
              <Text style={[text.caption, view === "list" && { color: color.text }]}>List</Text>
            </Pressable>
          </View>
          {(s.access?.surfaces ?? []).includes("orders") && (
            <Button title="Orders" variant="ghost" onPress={() => router.push("/orders")} />
          )}
          {(s.access?.surfaces ?? []).includes("sales") && (
            <Button title="Sales" variant="ghost" onPress={() => router.push("/history")} />
          )}
          {(s.access?.surfaces ?? []).includes("kds") && (
            <Button title="Kitchen" variant="ghost" onPress={() => router.push("/kds")} />
          )}
          <Button title="More" variant="ghost" onPress={() => setMoreOpen(true)} />
          {(s.access?.surfaces ?? []).includes("register") && (
            <>
              <Button title="New tab" variant="secondary" onPress={() => router.push("/register?mode=tab")} />
              <Button title="New to-go" onPress={() => router.push("/register?mode=togo")} />
            </>
          )}
        </View>
      </View>

      {view === "map" ? (
        <>
          {planTabs.length > 1 && (
            <View style={styles.controls}>
              <SegmentedTabs tabs={planTabs} value={activePlan ?? ""} onChange={(k) => setActivePlan(k)} />
            </View>
          )}
          {/* Full-screen floor — per-plan background (color / image), else the shared dark */}
          <View style={[styles.floor, colorBg ? { backgroundColor: colorBg } : null]} onLayout={onCanvasLayout}>
            {imageBg ? <Image source={{ uri: imageBg }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            {elements.length === 0 ? (
              <Text style={styles.emptyTxt}>No floor plan for this room. Design it in the web app.</Text>
            ) : (
              <>
                {/* Section zones (positions + sizes scale with the room) */}
                {zones.map((z) => (
                  <View key={z.id} style={{ position: "absolute", left: sx(z.minX) - 14, top: sy(z.minY) - 14, width: (z.maxX - z.minX) * Sx + 28, height: (z.maxY - z.minY) * Sy + 28, borderRadius: 22, backgroundColor: z.color + "22", borderWidth: 1, borderColor: z.color + "44" }}>
                    {z.name ? <Text style={[styles.zoneLabel, { color: z.color }]}>{z.name}</Text> : null}
                  </View>
                ))}
                {/* Structural décor scales with the room */}
                {decor.map((el) => (
                  <TableShape key={el.id} x={sx(el.x)} y={sy(el.y)} w={el.w * Sx} h={el.h * Sy} rotation={el.rotation} shape={el.shape} kind={el.kind} label={el.label} />
                ))}
                {/* Bar stools — fixed-size round seats at their scaled positions */}
                {stools.map((el) => {
                  const busy = !!summaries[el.id];
                  const numTxt = el.label ?? (el.seatNo != null ? String(el.seatNo) : "");
                  return (
                    <View
                      key={el.id}
                      style={{ position: "absolute", left: sx(el.x + el.w / 2) - STOOL / 2, top: sy(el.y + el.h / 2) - STOOL / 2, width: STOOL, height: STOOL, borderRadius: 9999, backgroundColor: busy ? F.stoolBusy : F.stoolOpen, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" }}
                    >
                      {numTxt ? <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Poppins_600SemiBold" }}>{numTxt}</Text> : null}
                    </View>
                  );
                })}
                {/* Tables — FIXED on-screen size, positioned by the fit */}
                {tables.map((t) => {
                  const summary = summaries[t.id];
                  // A server can't see other servers' checks: show those tables as
                  // "taken" (neutral, no order detail, not tappable).
                  const otherServer = scoped && !!summary && summary.staffId !== staffId;
                  const st = otherServer ? "occupied" : statusById[t.id] ?? "available";
                  const occupied = st !== "available";
                  const k = TSIZE / (Math.max(t.w, t.h) || 1);
                  const tw = t.w * k, th = t.h * k;
                  const tx = sx(t.x + t.w / 2) - tw / 2;
                  const ty = sy(t.y + t.h / 2) - th / 2;
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
                      fill={otherServer ? "#3A4152" : fillForTable(t, st)}
                      label={t.label}
                      occupied={occupied}
                      seats={seatCountByTable[t.id]}
                      sectionName={t.sectionId ? sectionName[t.sectionId] ?? null : null}
                      covers={otherServer ? null : summary?.guests ?? null}
                      timer={otherServer ? null : summary ? (summary.checkDropped ? "dropped" : formatElapsed(summary.openedAt, now)) : null}
                      total={otherServer ? null : summary && summary.subtotal > 0 ? money(summary.subtotal, "CAD") : null}
                      onPress={otherServer ? undefined : () => openTable(t, summary)}
                    />
                  );
                })}
              </>
            )}
          </View>
          <View style={styles.legend}>
            {LEGEND.map((l) => (
              <View key={l.status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: statusFill(l.status) }]} />
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

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Staff tools">
        <Button title="Time clock" variant="secondary" onPress={() => { setMoreOpen(false); router.push("/clock"); }} />
        <Button title="Reservations" variant="secondary" onPress={() => { setMoreOpen(false); router.push("/reservations"); }} />
        <Button title="Waitlist" variant="secondary" onPress={() => { setMoreOpen(false); router.push("/waitlist"); }} />
        <Button title="Customers" variant="secondary" onPress={() => { setMoreOpen(false); router.push("/customers"); }} />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  // Slim top bar (TB-style thin header).
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, gap: space.md },
  headerTitle: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 20, color: color.text },
  headerSub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: color.textDim },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  toggle: { flexDirection: "row", backgroundColor: color.card, borderRadius: 999, padding: 2, borderWidth: 1, borderColor: color.border },
  toggleBtn: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: 999 },
  toggleOn: { backgroundColor: color.card2 },
  controls: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xs },
  // Full-bleed floor: fills the whole area edge-to-edge, no inset/rounding.
  floor: { flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emptyTxt: { color: color.textDim, fontSize: 15, textAlign: "center" },
  zoneLabel: { position: "absolute", left: 12, bottom: 8, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  legend: { flexDirection: "row", justifyContent: "center", gap: space.lg, paddingVertical: space.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
  signout: { alignItems: "center", paddingVertical: space.xs },
});
