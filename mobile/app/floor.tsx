import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Plus, LogOut, Clock, CalendarCheck, Users, ClipboardList, Settings, UserRound, LayoutGrid, List, KeyRound } from "lucide-react-native";
import {
  SegmentedTabs,
  SearchField,
  TableCard,
  TableShape,
  Button,
  BottomSheet,
  EmptyState,
  Brand,
  color,
  floor as F,
  space,
  text,
  serviceStageColor,
  agingTier,
  STAGE_LABEL,
  STAGE_ORDER,
  AGING_LABEL,
  aging as agingColors,
  type ServiceStage,
  type AgingTier,
} from "@/design";
import { useSession } from "@/state/session";
import { notify } from "@/lib/notice";
import { supabase, realtimeChannel } from "@/lib/supabase";
import {
  fetchFloorPlans,
  fetchFloorElements,
  fetchSections,
  fetchTableSummaries,
  fetchTableAging,
  fetchOpenChecks,
  fetchKitchenTickets,
  type FloorPlan,
  type FloorElement,
  type FloorSection,
  type TableSummary,
  type OpenCheck,
  type KitchenTicket,
  type Aging,
} from "@/lib/reads";
import { serviceStage, kitchenStateByElement, type KitchenState } from "@/lib/service-stage";
import { demoOn } from "@/lib/demo/state";
import { formatDuration, formatOverdue, minutesSince, money } from "@/lib/format";
import { seesAllTables, isManager } from "@/lib/access";

const RINGABLE = new Set(["table", "booth"]);
const DECOR = new Set(["wall", "room", "label", "counter", "station"]);
const TSIZE = 152; // on-screen table size cap (longest side, px) — Floor v2 rich tiles
const TMIN_SHORT = 126; // floor for the short side so name + state + who + total + elapsed fit
const STOOL = 22; // fixed on-screen stool size (px)
const MARGIN = 84; // border so edge tables (up to 152px, centered) never clip

// Primary legend — the service lifecycle, read straight from the tokens so the
// legend can never disagree with the tiles/cards (same labels, same colors).
const LEGEND: { stage: ServiceStage; label: string }[] = STAGE_ORDER.map((stage) => ({ stage, label: STAGE_LABEL[stage] }));

export default function Floor() {
  const s = useSession();
  const router = useRouter();
  const bizId = s.businessId!;
  const staffId = s.staff?.id ?? null;
  // Servers see only tables they own; managers/owners see everything.
  const scoped = !seesAllTables(s.staff?.role ?? "");

  const { height: winH } = useWindowDimensions();
  const [view, setView] = useState<"map" | "list">("map");
  const [moreOpen, setMoreOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [elements, setElements] = useState<FloorElement[]>([]);
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [summaries, setSummaries] = useState<Record<string, TableSummary>>({});
  const [kitchen, setKitchen] = useState<KitchenTicket[]>([]);
  const [aging, setAging] = useState<Aging>({ yellowMin: 60, redMin: 90 });
  const [openChecks, setOpenChecks] = useState<OpenCheck[]>([]);
  // Table name per element across ALL rooms, so a Board card for a table on the
  // Patio still reads "Table 4" while the Map shows the Main floor.
  const [tableName, setTableName] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [pl, secs, ag] = await Promise.all([fetchFloorPlans(bizId), fetchSections(bizId), fetchTableAging(bizId)]);
        setPlans(pl);
        // Open to this device's default room if it's configured and still exists.
        const preferred = s.deviceProfile.defaultPlanId;
        const defaultPlan = (preferred && pl.some((p) => p.id === preferred) ? preferred : null) ?? pl[0]?.id ?? null;
        setActivePlan((cur) => cur ?? defaultPlan);
        setSections(secs);
        setAging(ag);

        const planName: Record<string, string> = Object.fromEntries(pl.map((p) => [p.id, p.name]));
        const secName: Record<string, string> = Object.fromEntries(secs.map((x) => [x.id, x.name]));
        const { data: allEls } = await supabase
          .from("floor_elements")
          .select("id, label, plan_id, section_id")
          .eq("business_id", bizId)
          .eq("is_active", true)
          .in("kind", ["table", "booth"]);
        const names: Record<string, string> = {};
        for (const e of allEls ?? []) if (e.label) names[e.id as string] = e.label as string;
        setTableName(names);
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
        notify("Couldn't load the latest — check your connection.");
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
      const [sum, checks, kt] = await Promise.all([fetchTableSummaries(bizId), fetchOpenChecks(bizId), fetchKitchenTickets(bizId)]);
      setSummaries(sum);
      setOpenChecks(checks);
      setKitchen(kt);
    } catch {
      /* ignore */
    }
  }, [bizId]);

  useEffect(() => {
    setNow(Date.now());
    loadLive();
    const channel = realtimeChannel("floor-" + bizId)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + bizId }, () => loadLive())
      // Kitchen bumps flip a table Sent → Ready — reload so the board keeps up.
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets", filter: "business_id=eq." + bizId }, () => loadLive())
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
  // Per-table kitchen state (open vs bumped tickets), keyed by element_id.
  const kstate = useMemo<Record<string, KitchenState>>(() => kitchenStateByElement(kitchen), [kitchen]);

  // Service stage + secondary aging tier per table. The stage color IS the fill
  // (status must read at a glance); section identity still shows via the zone
  // backgrounds + the "N seats · Section" line on vacant tiles.
  const stageById = useMemo(() => {
    const m: Record<string, ServiceStage> = {};
    for (const t of tables) {
      const sum = summaries[t.id];
      m[t.id] = sum ? serviceStage({ checkDropped: sum.checkDropped, elementId: t.id }, kstate) : "available";
    }
    return m;
  }, [tables, summaries, kstate]);

  const agingById = useMemo(() => {
    const m: Record<string, AgingTier> = {};
    for (const t of tables) {
      const sum = summaries[t.id];
      m[t.id] = sum ? agingTier(minutesSince(sum.openedAt, now), aging.yellowMin, aging.redMin) : "normal";
    }
    return m;
  }, [tables, summaries, aging, now]);

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

  // Board rows: each open check with its derived stage + aging, sorted by urgency
  // (Pay → Ready → Sent → Open), longest-open first within a stage.
  const boardRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<ServiceStage, number> = { pay: 0, ready: 1, sent: 2, open: 3, available: 4 };
    return openChecks
      .filter((c) => !scoped || c.staffId === staffId)
      .filter((c) => !q || c.label.toLowerCase().includes(q) || ((c.elementId && tableName[c.elementId]) ?? "").toLowerCase().includes(q) || (c.customerPhone ?? "").toLowerCase().includes(q))
      .map((c) => ({
        c,
        stage: serviceStage({ checkDropped: c.checkDropped, elementId: c.elementId }, kstate),
        tier: agingTier(minutesSince(c.openedAt, now), aging.yellowMin, aging.redMin),
      }))
      .sort((a, b) => rank[a.stage] - rank[b.stage] || (minutesSince(b.c.openedAt, now) ?? 0) - (minutesSince(a.c.openedAt, now) ?? 0));
  }, [openChecks, query, scoped, staffId, kstate, aging, now, tableName]);

  const planTabs = plans.map((p) => ({ key: p.id, label: p.name }));
  const activeBg = plans.find((p) => p.id === activePlan)?.background ?? null;
  const colorBg = activeBg?.type === "color" ? activeBg.value : null;
  const imageBg = activeBg?.type === "image" ? activeBg.value : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        {/* Product identity: SURGE · business · room. Staff identity moves to the
            right as a quiet chip; Sign out lives in Staff tools, not the floor. */}
        <Brand business={s.businessName} room={plans.find((p) => p.id === activePlan)?.name ?? null} demo={demoOn()} />
        <View style={styles.actions}>
          {/* Grouped nav: Floor (this screen) · Orders · Sales · Kitchen · More */}
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
          {/* One primary entry point — the picker chooses dine-in / takeout / pickup / delivery. */}
          {(s.access?.surfaces ?? []).includes("register") && (
            <Button title="New order" icon={<Plus size={18} color={color.onPrimary} strokeWidth={2.5} />} onPress={() => setOrderPickerOpen(true)} />
          )}
        </View>
      </View>

      {/* Local view controls — Map / Board toggle + who's signed in. */}
      <View style={styles.viewBar}>
        <View style={styles.toggle}>
          <Pressable onPress={() => setView("map")} style={[styles.toggleBtn, view === "map" && styles.toggleOn]} accessibilityRole="tab" accessibilityState={{ selected: view === "map" }}>
            <LayoutGrid size={16} color={view === "map" ? color.onPrimary : color.textDim} strokeWidth={2.25} />
            <Text style={[styles.toggleTxt, view === "map" && styles.toggleTxtOn]}>Map</Text>
          </Pressable>
          <Pressable onPress={() => setView("list")} style={[styles.toggleBtn, view === "list" && styles.toggleOn]} accessibilityRole="tab" accessibilityState={{ selected: view === "list" }}>
            <List size={16} color={view === "list" ? color.onPrimary : color.textDim} strokeWidth={2.25} />
            <Text style={[styles.toggleTxt, view === "list" && styles.toggleTxtOn]}>Board{openChecks.length > 0 ? " · " + openChecks.length : ""}</Text>
          </Pressable>
        </View>
        <View style={styles.spacer} />
        {s.staff?.name ? (
          <Pressable onPress={() => setMoreOpen(true)} style={styles.who} accessibilityRole="button" accessibilityLabel={"Signed in as " + s.staff.name + ". Staff tools"}>
            <UserRound size={16} color={color.textDim} strokeWidth={2.25} />
            <Text style={styles.whoTxt} numberOfLines={1}>
              {s.staff.name}
            </Text>
          </Pressable>
        ) : null}
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
              <EmptyState
                icon={<LayoutGrid size={26} color={color.textDim} strokeWidth={2} />}
                title={plans.length === 0 ? "No floor plan yet" : "This room has no tables yet"}
                body="Lay out tables, booths and the bar in the Surge web dashboard — they appear here live."
                actionLabel={(s.access?.surfaces ?? []).includes("register") ? "Start a takeout order" : undefined}
                onAction={(s.access?.surfaces ?? []).includes("register") ? () => router.push("/register?mode=togo") : undefined}
              />
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
                {/* Tables — rich lifecycle tiles, positioned by the fit */}
                {tables.map((t) => {
                  const summary = summaries[t.id];
                  // A server can't see other servers' checks: show those tables as
                  // "taken" (neutral, no order detail, not tappable).
                  const otherServer = scoped && !!summary && summary.staffId !== staffId;
                  const stage = otherServer ? "open" : stageById[t.id] ?? "available";
                  const occupied = !!summary;
                  const tier = otherServer ? "normal" : agingById[t.id] ?? "normal";
                  // Fit the long side to TSIZE, then floor the short side (aspect kept)
                  // so the rich content stays legible on wide/narrow tables alike.
                  const kLong = TSIZE / (Math.max(t.w, t.h) || 1);
                  let tw = t.w * kLong, th = t.h * kLong;
                  const short = Math.min(tw, th) || 1;
                  if (short < TMIN_SHORT) {
                    const b = TMIN_SHORT / short;
                    tw *= b;
                    th *= b;
                  }
                  const tx = sx(t.x + t.w / 2) - tw / 2;
                  const ty = sy(t.y + t.h / 2) - th / 2;
                  const overBy = summary ? Math.max(0, (minutesSince(summary.openedAt, now) ?? 0) - aging.redMin) : 0;
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
                      stage={stage}
                      fill={otherServer ? "#3A4152" : undefined}
                      label={t.label}
                      occupied={occupied}
                      seats={seatCountByTable[t.id]}
                      sectionName={t.sectionId ? sectionName[t.sectionId] ?? null : null}
                      stageLabel={otherServer ? "In use" : occupied ? STAGE_LABEL[stage] : null}
                      serverName={otherServer ? null : summary?.serverName ?? null}
                      covers={otherServer ? null : summary?.guests ?? null}
                      timer={otherServer ? null : summary ? formatDuration(summary.openedAt, now) : null}
                      total={otherServer ? null : summary && summary.subtotal > 0 ? money(summary.subtotal, "CAD") : null}
                      agingLabel={tier === "late" ? AGING_LABEL.late + (overBy > 0 ? " " + formatOverdue(overBy) : "") : null}
                      timerColor={tier === "warning" ? agingColors.warning : tier === "late" ? agingColors.late : null}
                      onPress={otherServer ? undefined : () => openTable(t, summary)}
                    />
                  );
                })}
              </>
            )}
          </View>
          <View style={styles.legend}>
            {LEGEND.map((l) => (
              <View key={l.stage} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: serviceStageColor(l.stage) }]} />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
            <View style={styles.legendSep} />
            <View style={styles.legendItem}>
              <Clock size={13} color={agingColors.warning} strokeWidth={2.5} />
              <Text style={styles.legendLabel}>Over {aging.yellowMin} min</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: agingColors.late }]}>
                <Text style={styles.legendBadgeTxt}>{AGING_LABEL.late}</Text>
              </View>
              <Text style={styles.legendLabel}>Over {aging.redMin} min</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.controls}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Find a check — name or phone" />
          </View>
          <ScrollView contentContainerStyle={styles.grid}>
            {boardRows.length === 0 && (
              <EmptyState
                icon={<ClipboardList size={26} color={color.textDim} strokeWidth={2} />}
                title={query.trim() ? "No checks match" : "No open checks"}
                body={query.trim() ? "Try a table name or the guest's phone number." : "Seat a table on the Map or start a new order — every open check shows here with its status and running total."}
                actionLabel={query.trim() ? "Clear search" : (s.access?.surfaces ?? []).includes("register") ? "New order" : undefined}
                onAction={query.trim() ? () => setQuery("") : (s.access?.surfaces ?? []).includes("register") ? () => setOrderPickerOpen(true) : undefined}
              />
            )}
            {boardRows.map(({ c, stage, tier }) => (
              <TableCard
                key={c.id}
                label={(c.elementId && tableName[c.elementId]) || c.label}
                stage={stage}
                stageLabel={STAGE_LABEL[stage]}
                serverName={c.serverName}
                guests={c.guests}
                sub={c.channel ?? c.ticketType ?? undefined}
                total={c.subtotal > 0 ? money(c.subtotal, "CAD") : undefined}
                durationLabel={formatDuration(c.openedAt, now)}
                agingTier={tier}
                lateBy={tier === "late" ? Math.max(0, (minutesSince(c.openedAt, now) ?? 0) - aging.redMin) : 0}
                onPress={() => router.push({ pathname: "/register", params: { ticket: c.id } })}
              />
            ))}
          </ScrollView>
        </>
      )}

      <BottomSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title="Staff tools">
        {/* Scrollable so every item (incl. owner-only Device settings) is reachable
            regardless of device height. Sign out lives here, off the floor. */}
        <ScrollView style={{ maxHeight: winH * 0.6 }} contentContainerStyle={{ gap: space.sm }} showsVerticalScrollIndicator={false}>
          {s.staff?.name ? (
            <View style={styles.whoCard}>
              <UserRound size={20} color={color.textDim} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={text.bodyMedium}>{s.staff.name}</Text>
                <Text style={text.caption}>{s.businessName}</Text>
              </View>
            </View>
          ) : null}
          <Button title="Time clock" variant="secondary" icon={<Clock size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); router.push("/clock"); }} />
          <Button title="Reservations" variant="secondary" icon={<CalendarCheck size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); router.push("/reservations"); }} />
          <Button title="Waitlist" variant="secondary" icon={<ClipboardList size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); router.push("/waitlist"); }} />
          <Button title="Customers" variant="secondary" icon={<Users size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); router.push("/customers"); }} />
          {isManager(s.staff?.role ?? "") && (
            <Button title="Device settings" variant="secondary" icon={<Settings size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); router.push("/device-settings"); }} />
          )}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button title="Switch staff" variant="ghost" icon={<KeyRound size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); s.clearStaff(); }} style={{ flex: 1 }} />
            <Button title="Sign out" variant="ghost" icon={<LogOut size={18} color={color.text} strokeWidth={2} />} onPress={() => { setMoreOpen(false); s.signOut(); }} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={orderPickerOpen} onClose={() => setOrderPickerOpen(false)} title="New order">
        {/* One entry point, four order types. Dine-in opens a fresh check (the
            server assigns a table by tapping the map); the others preset the
            order type in the register. Nothing is charged here. */}
        <View style={{ gap: space.sm }}>
          <Button title="Dine-in" size="lg" onPress={() => { setOrderPickerOpen(false); router.push("/register?mode=tab"); }} />
          <Button title="Takeout" variant="secondary" onPress={() => { setOrderPickerOpen(false); router.push("/register?mode=togo"); }} />
          <Button title="Pickup" variant="secondary" onPress={() => { setOrderPickerOpen(false); router.push("/register?mode=pickup"); }} />
          <Button title="Delivery" variant="secondary" onPress={() => { setOrderPickerOpen(false); router.push("/register?mode=delivery"); }} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  // Slim top bar (TB-style thin header).
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: space.md },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  // Local Map/Board control bar inside the Floor screen.
  viewBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  spacer: { flex: 1 },
  toggle: { flexDirection: "row", backgroundColor: color.card, borderRadius: 999, padding: 3, borderWidth: 1, borderColor: color.border },
  // ≥44pt touch target per segment.
  toggleBtn: { flexDirection: "row", gap: 6, minHeight: 44, minWidth: 96, paddingHorizontal: space.lg, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  toggleOn: { backgroundColor: color.blue },
  toggleTxt: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  toggleTxtOn: { color: color.onPrimary, fontFamily: "Poppins_600SemiBold" },
  who: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: space.md, borderRadius: 999, backgroundColor: color.card, borderWidth: 1, borderColor: color.border, maxWidth: 220 },
  whoTxt: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.textDim },
  whoCard: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 12, backgroundColor: color.card2, borderWidth: 1, borderColor: color.border, marginBottom: space.xs },
  controls: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.xs },
  // Full-bleed floor: fills the whole area edge-to-edge, no inset/rounding.
  floor: { flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  zoneLabel: { position: "absolute", left: 12, bottom: 8, fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  // Legend: labeled swatches, wraps; lifted off textDim for contrast.
  legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", columnGap: space.md, rowGap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 24 },
  legendDot: { width: 12, height: 12, borderRadius: 999 },
  legendLabel: { fontFamily: "Poppins_500Medium", fontSize: 14, color: color.text },
  legendBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  legendBadgeTxt: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#FFFFFF" },
  legendSep: { width: 1, height: 16, backgroundColor: color.border, marginHorizontal: space.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, padding: space.xl },
});
