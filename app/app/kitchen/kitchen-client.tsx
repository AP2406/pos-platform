"use client";

import { useEffect, useState, useCallback, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { displayItemName, formatDuration } from "@/lib/format";
import { allergenLabels } from "@/lib/allergens";
import { setCatalogItemOutOfStock } from "../catalog/actions";
import { markOrderFulfilled, markKitchenTicketFulfilled, markKitchenTicketsFulfilled, refireKitchenTicket, setKitchenItemReady, setOrderItemPrepared, recallKitchenTicket, recallOrder, setTicketRush, sendKitchenMessage } from "./actions";
import { printReceiptHtml } from "../pos/qz-print";
import { type KitchenTicketConfig, KITCHEN_TICKET_DEFAULTS } from "@/lib/services/kitchen-ticket-config";
import { STAGE_LABEL } from "@/lib/ui/service-status";

function allergenText(it: { allergens?: string[] | null; allergy?: string | null }): string {
  return [...allergenLabels(it.allergens), it.allergy ? it.allergy.trim() : ""]
    .filter(Boolean)
    .join(", ");
}

// B13: fixed kitchen-ticket labels by language (the printed chit; item names come
// from the menu and aren't translated).
const TICKET_I18N: Record<string, { allergen: string }> = {
  en: { allergen: "ALLERGEN" },
  fr: { allergen: "ALLERGÈNE" },
  es: { allergen: "ALÉRGENO" },
};

function ticketHtml(o: { tableLabel: string | null; id: string; createdAt: string; items: { name: string; quantity: number; note?: string | null; allergens?: string[] | null; allergy?: string | null; seat?: number | null; prep_minutes?: number | null }[] }, lang = "en", config: KitchenTicketConfig = KITCHEN_TICKET_DEFAULTS): string {
  const t = TICKET_I18N[lang] ?? TICKET_I18N.en;
  const title = o.tableLabel ? o.tableLabel : "#" + o.id.slice(0, 8);
  const rows = o.items
    .map((it) => {
      const allergens = config.show_allergens ? allergenText(it) : "";
      const seat = config.show_seat && it.seat ? " (S" + it.seat + ")" : "";
      const prep = config.show_prep_time && it.prep_minutes ? " · " + it.prep_minutes + "m" : "";
      return (
        "<div style='display:flex;justify-content:space-between'><span>" +
        it.quantity + "x " + esc(displayItemName(it.name)) + esc(seat + prep) + "</span></div>" +
        (config.show_note && it.note ? "<div style='font-size:11px;padding-left:8px'>&rarr; " + esc(it.note) + "</div>" : "") +
        (allergens ? "<div style='font-size:12px;padding-left:8px;font-weight:bold;color:#c00'>⚠ " + t.allergen + ": " + esc(allergens) + "</div>" : "")
      );
    })
    .join("");
  return (
    "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<style>body{font-family:'Courier New',monospace;font-size:14px;width:72mm;margin:0 auto;padding:6px}h1{font-size:16px;margin:0 0 6px}</style></head><body>" +
    "<h1>" + esc(title) + "</h1>" +
    (config.show_fire_time ? "<div style='font-size:11px;margin-bottom:4px'>" + esc(new Date(o.createdAt).toLocaleTimeString()) + "</div>" : "") +
    rows + "</body></html>"
  );
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type KitchenItem = { id?: string; name: string; quantity: number; note?: string | null; seat?: number | null; ready?: boolean; allergens?: string[] | null; allergy?: string | null; prep_minutes?: number | null; void?: boolean };
type KitchenStation = { id: string; name: string; sort_order: number };
type KitchenOrder = {
  id: string;
  kind: "order" | "kitchen";
  createdAt: string;
  customerName: string | null;
  tableLabel: string | null;
  stationId: string | null;
  stationName: string | null;
  elementId: string | null;
  tableName: string | null;
  rush?: boolean;
  channel: string | null;
  items: KitchenItem[];
};

// GAP-1: how each non-register channel is shown on a KDS card. NULL / "pos" = an
// in-store sale and gets no badge.
const CHANNEL_META: Record<string, { badge: string; title: string }> = {
  kiosk: { badge: "🖥 Kiosk", title: "Kiosk" },
  online: { badge: "🛍 Online", title: "Online order" },
  qr: { badge: "📱 QR", title: "QR table" },
  doordash: { badge: "🚗 DoorDash", title: "DoorDash" },
  ubereats: { badge: "🚗 Uber Eats", title: "Uber Eats" },
  grubhub: { badge: "🚗 Grubhub", title: "Grubhub" },
};

type RecentTicket = { id: string; kind: "kitchen" | "order"; label: string; fulfilledAt: string };
type MenuItem = { id: string; name: string; category: string | null; out_of_stock: boolean };

export function KitchenClient({
  businessId,
  initialOrders,
  stations,
  recent,
  menu,
  kdsWarn = 10,
  kdsLate = 18,
  recipes = {},
  lang = "en",
  printerFallback = false,
  initialStation = null,
  kitchenTicketConfig = KITCHEN_TICKET_DEFAULTS,
}: {
  businessId: string;
  initialOrders: KitchenOrder[];
  stations: KitchenStation[];
  initialStation?: string | null;
  recent?: RecentTicket[];
  menu?: MenuItem[];
  kdsWarn?: number;
  kdsLate?: number;
  recipes?: Record<string, string[]>;
  lang?: string;
  printerFallback?: boolean;
  kitchenTicketConfig?: KitchenTicketConfig;
}) {
  // B13: realtime-connection health → printer failover. When the KDS loses its
  // realtime link and the operator enabled fallback, newly-arrived tickets print.
  const [degraded, setDegraded] = useState(false);
  const degradedRef = useRef(false);
  useEffect(() => { degradedRef.current = degraded; }, [degraded]);
  // B5: which item's build card is open (keyed by base name).
  const [recipeItem, setRecipeItem] = useState<string | null>(null);
  const recipeLines = recipeItem ? recipes[recipeItem.toLowerCase()] ?? [] : [];
  // B3: bump-bar / keyboard nav — which ticket is focused (stations view).
  const [focusIdx, setFocusIdx] = useState(-1);
  const [showStale, setShowStale] = useState(false);
  // B8: which ticket the kitchen is messaging the server about.
  const [msgFor, setMsgFor] = useState<KitchenOrder | null>(null);
  function sendMsg(body: string) {
    const o = msgFor;
    if (!o) return;
    startTransition(async () => {
      await sendKitchenMessage(o.kind === "kitchen" ? { elementId: o.elementId, body } : { orderId: o.id, body });
      setMsgFor(null);
    });
  }
  const MSG_PRESETS = ["Item delayed", "86 mid-course", "Course held", "Re-fire needed", "See the kitchen"];
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  // Per-station screens: a ?station=<id> URL param locks this screen to one station; a
  // per-device saved default (restored on mount below) otherwise remembers the last pick,
  // so a dedicated Grill screen keeps showing Grill across reloads without re-tapping.
  const [stationFilter, setStationFilter] = useState<string>(() =>
    initialStation && stations.some((s) => s.id === initialStation) ? initialStation : "all"
  );
  function selectStation(id: string) {
    setStationFilter(id);
    try {
      if (id === "all") localStorage.removeItem("kds_station");
      else localStorage.setItem("kds_station", id);
    } catch {}
  }
  const [showAllDay, setShowAllDay] = useState(true);
  const [view, setView] = useState<"stations" | "expo">("stations");
  const [pending, startTransition] = useTransition();
  const [recentList, setRecentList] = useState<RecentTicket[]>(recent ?? []);
  useEffect(() => { setRecentList(recent ?? []); }, [recent]);

  // KDS-side 86 board.
  const [menuList, setMenuList] = useState<MenuItem[]>(menu ?? []);
  useEffect(() => { setMenuList(menu ?? []); }, [menu]);
  const [show86, setShow86] = useState(false);
  const [q86, setQ86] = useState("");
  function toggle86(m: MenuItem) {
    const next = !m.out_of_stock;
    setMenuList((prev) => prev.map((x) => (x.id === m.id ? { ...x, out_of_stock: next } : x)));
    startTransition(async () => {
      const res = await setCatalogItemOutOfStock(m.id, next);
      if ("error" in res) {
        // revert on failure
        setMenuList((prev) => prev.map((x) => (x.id === m.id ? { ...x, out_of_stock: !next } : x)));
      }
    });
  }

  // Audible alerts (per-device, off by default). Web Audio beeps — no files.
  const [soundOn, setSoundOn] = useState(false);
  // P1: a sticky STOP banner naming items the register just voided/86'd, on top
  // of the loud red ticket — so a busy line can't miss it. Auto-clears.
  const [stopItems, setStopItems] = useState<string[]>([]);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try { setSoundOn(localStorage.getItem("kds_sound") === "1"); } catch {}
  }, []);
  // Restore this device's saved station (unless the URL already locked one).
  useEffect(() => {
    if (initialStation) return;
    try {
      const saved = localStorage.getItem("kds_station");
      if (saved && stations.some((s) => s.id === saved)) setStationFilter(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const audioCtx = useRef<AudioContext | null>(null);
  const seenIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const alarmedIds = useRef<Set<string>>(new Set());

  const beep = useCallback((freq: number, durMs: number, type: OscillatorType = "sine") => {
    if (!soundOnRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtx.current) audioCtx.current = new Ctx();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durMs / 1000);
    } catch {}
  }, []);
  const chime = useCallback(() => { beep(880, 120); window.setTimeout(() => beep(1175, 150), 130); }, [beep]);
  const alarm = useCallback(() => { beep(440, 220, "square"); window.setTimeout(() => beep(440, 220, "square"), 280); }, [beep]);

  function toggleSound() {
    setSoundOn((v) => {
      const next = !v;
      try { localStorage.setItem("kds_sound", next ? "1" : "0"); } catch {}
      if (next) beep(1175, 120); // confirmation blip + unlocks the AudioContext
      return next;
    });
  }

  function handleRush(o: KitchenOrder) {
    const next = !o.rush;
    setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, rush: next } : x)));
    startTransition(async () => {
      const res = await setTicketRush(o.id, o.kind, next);
      if ("error" in res) {
        setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, rush: !next } : x)));
      }
    });
  }

  function handleRecall(r: RecentTicket) {
    startTransition(async () => {
      const res = r.kind === "kitchen" ? await recallKitchenTicket(r.id) : await recallOrder(r.id);
      if (!("error" in res)) {
        setRecentList((prev) => prev.filter((x) => x.id !== r.id));
        seenIds.current.add(r.id); // it's coming back — don't chime for it
        refresh();
      }
    });
  }

  // Ticks every 15s so the aging timers/colours stay current (display only).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  // Aging vs the ticket's prep target = the slowest item's prep_minutes. Amber at
  // the target, red at 1.5×. Tickets with no prep set fall back to the fixed
  // 10m/18m thresholds, so existing behaviour is unchanged.
  function ticketTarget(items: KitchenItem[]): number | null {
    let max = 0;
    for (const it of items) if (it.prep_minutes != null && it.prep_minutes > max) max = it.prep_minutes;
    return max > 0 ? max : null;
  }
  function aging(iso: string, items?: KitchenItem[]): { label: string; tone: ChipTone } {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    const target = items ? ticketTarget(items) : null;
    const warnAt = target ?? kdsWarn;
    const lateAt = target ? Math.round(target * 1.5) : kdsLate;
    const tone: ChipTone = mins >= lateAt ? "danger" : mins >= warnAt ? "warning" : "success";
    return { label: formatDuration(mins), tone };
  }

  // New-ticket chime (seeded on mount, so the initial board is silent). A new
  // void/86 notice sounds the distinct alarm tone instead of the chime.
  useEffect(() => {
    let freshNormal = false;
    let freshVoid = false;
    const voidNames: string[] = [];
    const freshTickets: KitchenOrder[] = [];
    for (const o of orders) {
      if (!seenIds.current.has(o.id)) {
        const vs = o.items.filter((it) => it.void === true).map((it) => displayItemName(it.name));
        if (vs.length > 0) {
          freshVoid = true;
          voidNames.push(...vs);
        } else { freshNormal = true; freshTickets.push(o); }
      }
    }
    seenIds.current = new Set(orders.map((o) => o.id));
    // B13: printer failover — when the realtime link is down, print incoming tickets.
    if (degradedRef.current && freshTickets.length > 0) {
      for (const o of freshTickets) { try { printReceiptHtml(ticketHtml(o, lang, kitchenTicketConfig)); } catch {} }
    }
    if (freshVoid) alarm();
    else if (freshNormal) chime();
    if (voidNames.length > 0) {
      setStopItems((prev) => Array.from(new Set([...prev, ...voidNames])));
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => setStopItems([]), 25000);
    }
  }, [orders, chime, alarm]);

  // Late alarm: a ticket crossing 18m sounds once.
  useEffect(() => {
    for (const o of orders) {
      const mins = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
      if (mins >= 18 && !alarmedIds.current.has(o.id)) {
        alarmedIds.current.add(o.id);
        alarm();
      }
    }
  }, [now, orders, alarm]);

  const refresh = useCallback(async () => {
    const supabase = createClient();

    // GAP-1: include channel for the per-card badge; fall back without it so the
    // KDS never goes blank before migration 0071 (channel column) is applied.
    const ordersQuery = (cols: string) =>
      supabase
        .from("orders")
        .select(cols)
        .eq("business_id", businessId)
        .eq("status", "paid")
        .is("fulfilled_at", null)
        .order("created_at", { ascending: true });
    let orderRes = await ordersQuery("id, customer_id, created_at, kds_prepared, rush, channel");
    if (orderRes.error) orderRes = await ordersQuery("id, customer_id, created_at, kds_prepared, rush");

    const rows = (orderRes.data ?? []) as unknown as Record<string, unknown>[];
    const ids = rows.map((o) => o.id as string);

    // Per-order set of prepared order_item ids (online/takeout per-item bump).
    const preparedByOrder: Record<string, Set<string>> = {};
    for (const o of rows) {
      const arr = Array.isArray(o.kds_prepared) ? (o.kds_prepared as string[]) : [];
      preparedByOrder[o.id as string] = new Set(arr);
    }

    const itemsByOrder: Record<string, KitchenItem[]> = {};
    if (ids.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, order_id, name, quantity")
        .in("order_id", ids);
      for (const it of items ?? []) {
        const oid = it.order_id as string;
        const iid = it.id as string;
        if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
        itemsByOrder[oid].push({
          id: iid,
          name: it.name as string,
          quantity: Number(it.quantity),
          ready: preparedByOrder[oid]?.has(iid) ?? false,
        });
      }
    }

    const customerNames: Record<string, string> = {};
    const custIds = rows
      .map((o) => o.customer_id as string | null)
      .filter((x): x is string => !!x);
    if (custIds.length > 0) {
      const { data: custs } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", custIds);
      for (const c of custs ?? []) {
        customerNames[c.id as string] = c.name as string;
      }
    }

    const orderCards: KitchenOrder[] = rows.map((o) => ({
      id: o.id as string,
      kind: "order",
      createdAt: (o.created_at as string) ?? new Date().toISOString(),
      customerName: o.customer_id ? customerNames[o.customer_id as string] ?? null : null,
      tableLabel: null,
      stationId: null,
      stationName: null,
      elementId: null,
      tableName: null,
      rush: (o.rush as boolean | null) ?? false,
      channel: (o.channel as string | null) ?? null,
      items: itemsByOrder[o.id as string] ?? [],
    }));

    const { data: kts } = await supabase
      .from("kitchen_tickets")
      .select("id, label, items, fired_at, station_id, element_id, rush")
      .eq("business_id", businessId)
      .is("fulfilled_at", null)
      .order("fired_at", { ascending: true });

    const stationNameById: Record<string, string> = {};
    for (const s of stations) stationNameById[s.id] = s.name;

    const elementIds = Array.from(
      new Set((kts ?? []).map((k) => k.element_id as string | null).filter((x): x is string => !!x))
    );
    const elementLabelById: Record<string, string> = {};
    if (elementIds.length > 0) {
      const { data: els } = await supabase
        .from("floor_elements")
        .select("id, label")
        .in("id", elementIds);
      for (const e of els ?? []) elementLabelById[e.id as string] = (e.label as string | null) ?? "Table";
    }

    const kitchenCards: KitchenOrder[] = (kts ?? []).map((k) => {
      const elementId = (k.element_id as string | null) ?? null;
      const stationId = (k.station_id as string | null) ?? null;
      return {
      id: k.id as string,
      kind: "kitchen" as const,
      createdAt: (k.fired_at as string) ?? new Date().toISOString(),
      customerName: null,
      tableLabel: (k.label as string | null) ?? null,
      stationId,
      stationName: stationId ? stationNameById[stationId] ?? null : null,
      elementId,
      tableName: elementId ? elementLabelById[elementId] ?? "Table" : (k.label as string | null) ?? "Ticket",
      rush: (k.rush as boolean | null) ?? false,
      channel: null,
      items: Array.isArray(k.items) ? (k.items as KitchenItem[]) : [],
    };
    });

    setOrders(
      [...orderCards, ...kitchenCards].sort((a, b) =>
        a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
      )
    );
  }, [businessId, stations]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("kitchen-" + businessId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: "business_id=eq." + businessId },
        () => {
          refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_tickets", filter: "business_id=eq." + businessId },
        () => {
          refresh();
        }
      )
      .subscribe((status) => {
        // B13: a dropped/errored channel flips the KDS into printer-fallback mode.
        const ok = status === "SUBSCRIBED";
        setDegraded(printerFallback ? !ok : false);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, refresh, printerFallback]);

  function handleReprint(o: KitchenOrder) {
    printReceiptHtml(ticketHtml(o, lang, kitchenTicketConfig));
  }

  function handleRefire(o: KitchenOrder) {
    startTransition(async () => {
      await refireKitchenTicket(o.id);
      refresh();
    });
  }

  function handleDone(o: KitchenOrder) {
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    startTransition(async () => {
      const res =
        o.kind === "kitchen"
          ? await markKitchenTicketFulfilled(o.id)
          : await markOrderFulfilled(o.id);
      if ("error" in res) {
        refresh();
      }
    });
  }

  // P1-17: toggle a single line ready as it's plated (optimistic, then persist).
  function handleItemReady(ticketId: string, index: number, ready: boolean) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === ticketId
          ? { ...o, items: o.items.map((it, i) => (i === index ? { ...it, ready } : it)) }
          : o
      )
    );
    startTransition(async () => {
      const res = await setKitchenItemReady(ticketId, index, ready);
      if ("error" in res) refresh();
    });
  }

  // Per-item bump for online/takeout/delivery "order" tickets (keyed by the
  // order_item id, persisted in orders.kds_prepared). Optimistic, then persist.
  function handleOrderItemPrepared(orderId: string, itemId: string, ready: boolean) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((it) => (it.id === itemId ? { ...it, ready } : it)) }
          : o
      )
    );
    startTransition(async () => {
      const res = await setOrderItemPrepared(orderId, itemId, ready);
      if ("error" in res) refresh();
    });
  }

  // P1-16: bump every ticket of one table from the expo view.
  function handleBumpTable(ids: string[]) {
    const set = new Set(ids);
    setOrders((prev) => prev.filter((x) => !set.has(x.id)));
    startTransition(async () => {
      const res = await markKitchenTicketsFulfilled(ids);
      if ("error" in res) refresh();
    });
  }

  function timeLabel(iso: string): string {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    const mm = m < 10 ? "0" + m : "" + m;
    return h + ":" + mm + " " + ampm;
  }

  // P1-14: a station screen sees only its own tickets. "All" shows everything
  // (including online orders, which have no station).
  const visible = (
    stationFilter === "all" ? orders : orders.filter((o) => o.stationId === stationFilter)
  )
    .slice()
    .sort((a, b) => (a.rush === b.rush ? 0 : a.rush ? -1 : 1)); // rush floats to front (stable)

  // Only tickets from the current service day (< 24h) are "active" and drive the
  // board, oldest-first. Anything older is a stale straggler (a missed bump or a
  // pre-day-close ticket) — collapsed below so it never buries fresh tickets.
  const STALE_MS = 24 * 60 * 60 * 1000;
  const activeVisible = visible.filter((o) => now - new Date(o.createdAt).getTime() < STALE_MS);
  const staleVisible = visible.filter((o) => now - new Date(o.createdAt).getTime() >= STALE_MS);

  // B3: bump-bar — arrow keys move focus, Enter/Space bumps the focused ticket,
  // R recalls the last bump, Esc clears. Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (view !== "stations") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(activeVisible.length - 1, i < 0 ? 0 : i + 1)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(0, i < 0 ? 0 : i - 1)); }
      else if (e.key === "Enter" || e.key === " ") { if (focusIdx >= 0 && activeVisible[focusIdx]) { e.preventDefault(); handleDone(activeVisible[focusIdx]); setFocusIdx((i) => Math.min(i, activeVisible.length - 2)); } }
      else if (e.key === "r" || e.key === "R") { if (recentList[0]) { e.preventDefault(); handleRecall(recentList[0]); } }
      else if (e.key === "Escape") setFocusIdx(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVisible, focusIdx, recentList, view]);

  // P1-15: all-day counts — total ORDERED quantity of each item across every
  // visible (unfulfilled) ticket, so the line sees full demand at a glance.
  // Reflects ordered quantities, NOT per-item prep state — bumping a line never
  // changes these counts (a ticket only leaves all-day when it's marked Done).
  // Respects the active station filter; modifier annotations like "(+ Medium)"
  // are stripped so all temperatures of a Burger roll up to one count.
  const allDay = (() => {
    const m = new Map<string, number>();
    for (const o of visible) {
      for (const it of o.items) {
        // Strip modifier annotations ("(+ Medium)") AND the split "(shared)"
        // marker so all variants of one item roll up to a single count.
        const base = displayItemName(it.name.replace(/\s*\(\+[^)]*\)\s*$/, ""));
        if (!base) continue;
        m.set(base, (m.get(base) ?? 0) + (Number(it.quantity) || 0));
      }
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  })();

  const allDayPanel =
    allDay.length > 0 ? (
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All day</span>
          <button
            type="button"
            onClick={() => setShowAllDay((v) => !v)}
            className="text-xs text-muted-foreground underline"
          >
            {showAllDay ? "Hide" : "Show"}
          </button>
        </div>
        {showAllDay && (
          <div className="flex flex-wrap gap-2">
            {allDay.map(([name, qty]) => (
              <span key={name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-sm">
                <span className="truncate max-w-[180px]">{name}</span>
                <span className="tabular-nums font-semibold">{"×" + qty}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    ) : null;

  // B11: per-station load — open (unbumped) item count + oldest age, so a backed-up
  // station is obvious at a glance on the filter bar.
  const stationLoad = new Map<string, { items: number; oldest: number }>();
  for (const o of orders) {
    if (!o.stationId) continue;
    const openItems = o.items.filter((it) => !it.void && !it.ready).reduce((s, it) => s + (Number(it.quantity) || 1), 0);
    if (openItems <= 0) continue;
    const cur = stationLoad.get(o.stationId) ?? { items: 0, oldest: 0 };
    cur.items += openItems;
    const mins = Math.floor((now - new Date(o.createdAt).getTime()) / 60000);
    if (mins > cur.oldest) cur.oldest = mins;
    stationLoad.set(o.stationId, cur);
  }

  const stationStrip =
    stations.length > 0 ? (
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => selectStation("all")}
          className={
            "text-sm rounded-md px-3 py-1.5 border " +
            (stationFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")
          }
        >
          All
        </button>
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectStation(s.id)}
            className={
              "text-sm rounded-md px-3 py-1.5 border " +
              (stationFilter === s.id ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")
            }
          >
            {s.name}
            {(() => {
              const ld = stationLoad.get(s.id);
              if (!ld) return null;
              const hot = ld.oldest >= kdsLate;
              return <span className={"ml-1.5 text-[11px] tabular-nums " + (stationFilter === s.id ? "opacity-90" : hot ? "text-red-600 font-semibold" : "text-muted-foreground")}>{ld.items}·{formatDuration(ld.oldest)}</span>;
            })()}
          </button>
        ))}
      </div>
    ) : null;

  const viewToggle = (
    <div className="flex gap-2 mb-4 items-center">
      {(["stations", "expo"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setView(v)}
          className={
            "text-sm rounded-md px-3 py-1.5 border " +
            (view === v ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")
          }
        >
          {v === "stations" ? "By station" : "Expo"}
        </button>
      ))}
      <button
        type="button"
        onClick={toggleSound}
        title={soundOn ? "Sound alerts on" : "Sound alerts off"}
        className={
          "ml-auto text-sm rounded-md px-3 py-1.5 border " +
          (soundOn
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
            : "border-border hover:bg-accent text-muted-foreground")
        }
      >
        {soundOn ? "🔊 Sound" : "🔇 Sound"}
      </button>
    </div>
  );

  // B13: printer-fallback banner.
  const degradedBanner = degraded ? (
    <div className="mb-4 rounded-xl border-2 border-amber-500 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
      🖨️ KDS connection lost — new tickets are printing to the kitchen printer until it reconnects.
    </div>
  ) : null;

  // B8: message-the-server modal.
  const msgModal = msgFor ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setMsgFor(null)}>
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Message {msgFor.tableName ?? msgFor.tableLabel ?? msgFor.customerName ?? "server"}</h3>
          <button type="button" onClick={() => setMsgFor(null)} className="text-xs text-muted-foreground underline">Close</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {MSG_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => sendMsg(p)} disabled={pending} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50">{p}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Sent live to the table&apos;s server.</p>
      </div>
    </div>
  ) : null;

  // B5: build-card modal.
  const recipeModal = recipeItem ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setRecipeItem(null)}>
      <div className="bg-card border border-border rounded-lg p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{recipeItem}</h3>
          <button type="button" onClick={() => setRecipeItem(null)} className="text-xs text-muted-foreground underline">Close</button>
        </div>
        {recipeLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No build card for this item.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {recipeLines.map((l, i) => <li key={i} className="flex items-start gap-2"><span className="text-muted-foreground">•</span>{l}</li>)}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  const stopBanner =
    stopItems.length > 0 ? (
      <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-red-600 bg-red-600/15 px-4 py-3 text-red-700 dark:text-red-300">
        <span className="text-2xl leading-none">⛔</span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">STOP — do not make</div>
          <div className="text-sm truncate">{stopItems.join(", ")}</div>
        </div>
        <button
          type="button"
          onClick={() => setStopItems([])}
          className="shrink-0 text-sm rounded-md border border-red-600/50 px-3 py-1.5 hover:bg-red-600/10"
        >
          Got it
        </button>
      </div>
    ) : null;

  const recallStrip =
    recentList.length > 0 ? (
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Recall:</span>
        {recentList.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => handleRecall(r)}
            disabled={pending}
            className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent disabled:opacity-60"
          >
            {"↩ " + r.label}
          </button>
        ))}
      </div>
    ) : null;

  const eightySixed = menuList.filter((m) => m.out_of_stock);
  const board86 =
    menuList.length > 0 ? (
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShow86((v) => !v)}
            className="text-sm rounded-md px-3 py-1.5 border border-border hover:bg-accent"
          >
            {show86 ? "Close 86 board" : "86 board"}
          </button>
          {eightySixed.length > 0 && !show86 && (
            <span className="text-xs text-red-600 font-semibold truncate">
              {"86'd: " + eightySixed.slice(0, 6).map((m) => m.name).join(", ") + (eightySixed.length > 6 ? "…" : "")}
            </span>
          )}
        </div>
        {show86 && (
          <div className="mt-2 bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
            <input
              value={q86}
              onChange={(e) => setQ86(e.target.value)}
              placeholder="Search the menu to 86…"
              className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="max-h-64 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
              {menuList
                .filter((m) => !q86 || m.name.toLowerCase().includes(q86.toLowerCase()))
                .slice(0, 100)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle86(m)}
                    disabled={pending}
                    className={
                      "flex items-center justify-between gap-2 text-left text-sm rounded-md border px-2.5 py-2 min-h-[40px] disabled:opacity-60 " +
                      (m.out_of_stock
                        ? "border-red-500/50 bg-red-500/10 text-red-600 font-medium"
                        : "border-border hover:bg-accent")
                    }
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs shrink-0">{m.out_of_stock ? "un-86" : "86"}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    ) : null;

  // One single ticket / order card (used by the station grid and for online
  // orders in the expo grid).
  function card(o: KitchenOrder, focused = false) {
    const age = aging(o.createdAt, o.items);
    // Subtle "ready" cue once every line is bumped (does NOT auto-complete).
    const allReady = o.items.length > 0 && o.items.every((it) => it.ready);
    // A void/86 notice fired to the kitchen — loud red so the line can't miss it.
    const isVoid = o.items.some((it) => it.void === true);
    const ringClass = focused
      ? "ring-2 ring-sky-500 bg-sky-500/5"
      : isVoid
      ? "ring-2 ring-red-500/70 bg-red-500/5"
      : o.rush
      ? "ring-2 ring-orange-500/70 bg-orange-500/5"
      : "ring-1 ring-line";
    return (
      <div key={o.id} className={"bg-card shadow-elevation rounded-xl p-4 flex flex-col " + ringClass}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            {o.rush && !isVoid && (
              <div className="text-[11px] font-bold uppercase tracking-wide text-orange-600 mb-0.5">🔥 Rush</div>
            )}
            {o.channel && CHANNEL_META[o.channel] && !isVoid && (
              <div className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-0.5">{CHANNEL_META[o.channel].badge}</div>
            )}
            {isVoid ? (
              <div className="text-lg font-bold leading-tight truncate text-red-600">⚠ VOID — {o.tableName ?? o.tableLabel ?? "Table"}</div>
            ) : o.kind === "kitchen" ? (
              <div className="text-lg font-bold leading-tight truncate">{o.tableName ?? o.tableLabel ?? "Table"}</div>
            ) : (
              <div className="text-lg font-bold leading-tight truncate">{(o.channel && CHANNEL_META[o.channel]?.title) || "Online"}</div>
            )}
            <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
              {(o.kind === "kitchen" ? "" : "#" + o.id.slice(0, 8) + " · ") + timeLabel(o.createdAt)}
            </div>
          </div>
          <Chip tone={age.tone} dot className="shrink-0">{age.label}</Chip>
        </div>
        {o.customerName && <div className="text-xs text-muted-foreground mb-2">{o.customerName}</div>}
        <div className="space-y-1 text-sm flex-1">
          {o.items.length === 0 ? (
            <div className="text-xs text-muted-foreground">Loading items...</div>
          ) : (
            o.items.map((it, i) =>
              // P1-17: on a fired ticket, tap a line to mark it ready as it's plated.
              o.kind === "kitchen" ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleItemReady(o.id, i, !it.ready)}
                  className="w-full text-left flex flex-col justify-center rounded px-1 -mx-1 py-2 min-h-[44px] hover:bg-accent"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className={"min-w-0 flex items-center gap-2 " + (it.ready ? "text-muted-foreground" : "")}>
                      {/* Per-item bump: tap to mark this line done (round target). */}
                      <span className={"shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[11px] leading-none transition-colors " + (it.ready ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 text-transparent")}>✓</span>
                      <span className={"truncate" + (it.ready ? " line-through" : "") + (it.void ? " line-through text-red-600 font-semibold" : "")}>{(it.void ? "✗ " : "") + (it.seat ? "S" + it.seat + " · " : "") + displayItemName(it.name)}</span>
                      {recipes[displayItemName(it.name).toLowerCase()] && <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setRecipeItem(displayItemName(it.name)); }} className="shrink-0 text-[10px] text-sky-600 underline">build</span>}
                    </span>
                    <span className={"tabular-nums " + (it.ready ? "text-muted-foreground line-through" : "text-muted-foreground")}>{"x" + it.quantity}</span>
                  </div>
                  {it.note ? <span className="text-xs text-amber-600 pl-2">{"→ " + it.note}</span> : null}
                  {allergenText(it) ? <span className="text-xs font-bold text-red-600 pl-2">{"⚠ ALLERGEN: " + allergenText(it)}</span> : null}
                </button>
              ) : (
                // Online/takeout/delivery line — per-item bump via order_item id.
                <button
                  key={i}
                  type="button"
                  onClick={() => { if (it.id) handleOrderItemPrepared(o.id, it.id, !it.ready); }}
                  disabled={!it.id}
                  className="w-full text-left flex flex-col justify-center rounded px-1 -mx-1 py-2 min-h-[44px] hover:bg-accent disabled:hover:bg-transparent"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className={"min-w-0 flex items-center gap-2 " + (it.ready ? "text-muted-foreground" : "")}>
                      <span className={"shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[11px] leading-none transition-colors " + (it.ready ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 text-transparent")}>✓</span>
                      <span className={"truncate" + (it.ready ? " line-through" : "") + (it.void ? " line-through text-red-600 font-semibold" : "")}>{(it.void ? "✗ " : "") + (it.seat ? "S" + it.seat + " · " : "") + displayItemName(it.name)}</span>
                      {recipes[displayItemName(it.name).toLowerCase()] && <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setRecipeItem(displayItemName(it.name)); }} className="shrink-0 text-[10px] text-sky-600 underline">build</span>}
                    </span>
                    <span className={"tabular-nums " + (it.ready ? "text-muted-foreground line-through" : "text-muted-foreground")}>{"x" + it.quantity}</span>
                  </div>
                  {it.note ? <span className="text-xs text-amber-600 pl-2">{"→ " + it.note}</span> : null}
                </button>
              )
            )
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {!isVoid && (
            <Button
              variant="outline"
              size="touch"
              onClick={() => handleRush(o)}
              disabled={pending}
              className={o.rush ? "border-orange-500/60 text-orange-600" : ""}
            >
              {o.rush ? "Unrush" : "Rush"}
            </Button>
          )}
          <Button variant="outline" size="touch" onClick={() => handleReprint(o)}>Reprint</Button>
          <Button variant="outline" size="touch" onClick={() => setMsgFor(o)} disabled={pending} title="Message the server">Msg</Button>
          {o.kind === "kitchen" && (
            <Button variant="outline" size="touch" onClick={() => handleRefire(o)} disabled={pending}>Re-fire</Button>
          )}
          <Button variant="primary" size="touch" className={"flex-1" + (allReady ? " ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-card" : "")} onClick={() => handleDone(o)} disabled={pending}>{allReady ? STAGE_LABEL.ready : "Done"}</Button>
        </div>
      </div>
    );
  }

  const emptyCard = (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-10 text-center">
      <p className="text-sm text-muted-foreground">No open orders. New sales will appear here automatically.</p>
    </div>
  );

  // P1-16: expo / expediter view — re-assemble each table's station & course
  // tickets into one card so the expediter sees the whole order, and bump the
  // whole table out at once. Online orders stay as their own cards.
  if (view === "expo") {
    const orderCards = orders.filter((o) => o.kind === "order");
    const kitchenCards = orders.filter((o) => o.kind === "kitchen");
    type ExpoGroup = { key: string; tableName: string; firstAt: string; tickets: KitchenOrder[] };
    const expoMap = new Map<string, ExpoGroup>();
    for (const o of kitchenCards) {
      const key = o.elementId ?? "kt:" + o.id;
      const g = expoMap.get(key);
      if (g) {
        g.tickets.push(o);
        if (o.createdAt < g.firstAt) g.firstAt = o.createdAt;
      } else {
        expoMap.set(key, { key, tableName: o.tableName ?? "Ticket", firstAt: o.createdAt, tickets: [o] });
      }
    }
    const expoGroups = Array.from(expoMap.values()).sort((a, b) =>
      a.firstAt < b.firstAt ? -1 : a.firstAt > b.firstAt ? 1 : 0
    );

    return (
      <div>
        {viewToggle}
        {stopBanner}
        {recipeModal}
        {msgModal}
        {degradedBanner}
        {board86}
        {recallStrip}
        {allDayPanel}
        {expoGroups.length === 0 && orderCards.length === 0 ? (
          emptyCard
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expoGroups.map((g) => {
              const gAge = aging(g.firstAt, g.tickets.flatMap((t) => t.items));
              // B2: the whole table is ready to plate only when every station's items are bumped.
              const groupReady = g.tickets.length > 0 && g.tickets.every((t) => t.items.length > 0 && t.items.every((it) => it.void || it.ready));
              return (
              <div key={g.key} className={"bg-card ring-1 shadow-elevation rounded-xl p-4 flex flex-col " + (groupReady ? "ring-2 ring-emerald-400" : "ring-line")}>
                {groupReady && (
                  <div className="mb-2 -mt-1 text-center text-xs font-bold text-emerald-600 bg-emerald-500/10 rounded-md py-1">✓ ALL READY — PLATE</div>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-lg font-bold leading-tight truncate">{g.tableName}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{timeLabel(g.firstAt)}</div>
                  </div>
                  <Chip tone={gAge.tone} dot className="shrink-0">{gAge.label}</Chip>
                </div>
                <div className="space-y-2 text-sm flex-1">
                  {g.tickets.map((t) => (
                    <div key={t.id}>
                      {t.stationName && (
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{t.stationName}</div>
                      )}
                      {t.items.map((it, i) => (
                        <div key={i} className="flex flex-col">
                          <div className="flex justify-between">
                            <span className={"truncate " + (it.ready ? "line-through text-muted-foreground" : "")}>{(it.seat ? "S" + it.seat + " · " : "") + displayItemName(it.name)}</span>
                            <span className={"tabular-nums text-muted-foreground " + (it.ready ? "line-through" : "")}>{"x" + it.quantity}</span>
                          </div>
                          {it.note ? <span className="text-xs text-amber-600 pl-2">{"→ " + it.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" size="touch" className="flex-1" onClick={() => handleBumpTable(g.tickets.map((t) => t.id))} disabled={pending}>
                    Bump table
                  </Button>
                </div>
              </div>
              );
            })}
            {orderCards.map((o) => card(o))}
          </div>
        )}
      </div>
    );
  }

  // By-station view (default).
  return (
    <div>
      {viewToggle}
      {stopBanner}
        {recipeModal}
        {msgModal}
        {degradedBanner}
      {board86}
      {recallStrip}
      {stationStrip}
      {allDayPanel}
      {activeVisible.length === 0 && staleVisible.length === 0 ? (
        emptyCard
      ) : (
        <>
          {activeVisible.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeVisible.map((o, idx) => card(o, idx === focusIdx))}
            </div>
          )}
          {staleVisible.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowStale((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-1.5"
              >
                {(showStale ? "▾ " : "▸ ") + staleVisible.length + " stale ticket" + (staleVisible.length === 1 ? "" : "s") + " (older than 24h)"}
              </button>
              {showStale && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2 opacity-60">
                  {staleVisible.map((o) => card(o))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
