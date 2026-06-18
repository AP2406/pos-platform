"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { displayItemName, formatDuration } from "@/lib/format";
import { allergenLabels } from "@/lib/allergens";
import { markOrderFulfilled, markKitchenTicketFulfilled, markKitchenTicketsFulfilled, refireKitchenTicket, setKitchenItemReady, setOrderItemPrepared } from "./actions";
import { printReceiptHtml } from "../pos/qz-print";

function allergenText(it: { allergens?: string[] | null; allergy?: string | null }): string {
  return [...allergenLabels(it.allergens), it.allergy ? it.allergy.trim() : ""]
    .filter(Boolean)
    .join(", ");
}

function ticketHtml(o: { tableLabel: string | null; id: string; createdAt: string; items: { name: string; quantity: number; note?: string | null; allergens?: string[] | null; allergy?: string | null }[] }): string {
  const title = o.tableLabel ? o.tableLabel : "#" + o.id.slice(0, 8);
  const rows = o.items
    .map((it) => {
      const allergens = allergenText(it);
      return (
        "<div style='display:flex;justify-content:space-between'><span>" +
        it.quantity + "x " + esc(displayItemName(it.name)) + "</span></div>" +
        (it.note ? "<div style='font-size:11px;padding-left:8px'>&rarr; " + esc(it.note) + "</div>" : "") +
        (allergens ? "<div style='font-size:12px;padding-left:8px;font-weight:bold;color:#c00'>⚠ ALLERGEN: " + esc(allergens) + "</div>" : "")
      );
    })
    .join("");
  return (
    "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
    "<style>body{font-family:'Courier New',monospace;font-size:14px;width:72mm;margin:0 auto;padding:6px}h1{font-size:16px;margin:0 0 6px}</style></head><body>" +
    "<h1>" + esc(title) + "</h1>" + rows + "</body></html>"
  );
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type KitchenItem = { id?: string; name: string; quantity: number; note?: string | null; seat?: number | null; ready?: boolean; allergens?: string[] | null; allergy?: string | null };
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
  items: KitchenItem[];
};

export function KitchenClient({
  businessId,
  initialOrders,
  stations,
}: {
  businessId: string;
  initialOrders: KitchenOrder[];
  stations: KitchenStation[];
}) {
  const [orders, setOrders] = useState<KitchenOrder[]>(initialOrders);
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [showAllDay, setShowAllDay] = useState(true);
  const [view, setView] = useState<"stations" | "expo">("stations");
  const [pending, startTransition] = useTransition();

  // Ticks every 15s so the aging timers/colours stay current (display only).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  // Aging vs a full-service cook-time target: fresh < 10m (green), warming
  // 10–18m (amber), late > 18m (red) — readable across a kitchen at a glance.
  function aging(iso: string): { label: string; tone: ChipTone } {
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    const tone: ChipTone = mins >= 18 ? "danger" : mins >= 10 ? "warning" : "success";
    return { label: formatDuration(mins), tone };
  }

  const refresh = useCallback(async () => {
    const supabase = createClient();

    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, customer_id, created_at, kds_prepared")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .is("fulfilled_at", null)
      .order("created_at", { ascending: true });

    const rows = orderRows ?? [];
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
      items: itemsByOrder[o.id as string] ?? [],
    }));

    const { data: kts } = await supabase
      .from("kitchen_tickets")
      .select("id, label, items, fired_at, station_id, element_id")
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, refresh]);

  function handleReprint(o: KitchenOrder) {
    printReceiptHtml(ticketHtml(o));
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
  const visible =
    stationFilter === "all" ? orders : orders.filter((o) => o.stationId === stationFilter);

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

  const stationStrip =
    stations.length > 0 ? (
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setStationFilter("all")}
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
            onClick={() => setStationFilter(s.id)}
            className={
              "text-sm rounded-md px-3 py-1.5 border " +
              (stationFilter === s.id ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")
            }
          >
            {s.name}
          </button>
        ))}
      </div>
    ) : null;

  const viewToggle = (
    <div className="flex gap-2 mb-4">
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
    </div>
  );

  // One single ticket / order card (used by the station grid and for online
  // orders in the expo grid).
  function card(o: KitchenOrder) {
    const age = aging(o.createdAt);
    // Subtle "ready" cue once every line is bumped (does NOT auto-complete).
    const allReady = o.items.length > 0 && o.items.every((it) => it.ready);
    return (
      <div key={o.id} className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            {o.kind === "kitchen" ? (
              <div className="text-lg font-bold leading-tight truncate">{o.tableName ?? o.tableLabel ?? "Table"}</div>
            ) : (
              <div className="text-lg font-bold leading-tight truncate">Online</div>
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
                      <span className={"truncate" + (it.ready ? " line-through" : "")}>{(it.seat ? "S" + it.seat + " · " : "") + displayItemName(it.name)}</span>
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
                      <span className={"truncate" + (it.ready ? " line-through" : "")}>{(it.seat ? "S" + it.seat + " · " : "") + displayItemName(it.name)}</span>
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
          <Button variant="outline" size="touch" onClick={() => handleReprint(o)}>Reprint</Button>
          {o.kind === "kitchen" && (
            <Button variant="outline" size="touch" onClick={() => handleRefire(o)} disabled={pending}>Re-fire</Button>
          )}
          <Button variant="primary" size="touch" className={"flex-1" + (allReady ? " ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-card" : "")} onClick={() => handleDone(o)} disabled={pending}>{allReady ? "Done · ready" : "Done"}</Button>
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
        {allDayPanel}
        {expoGroups.length === 0 && orderCards.length === 0 ? (
          emptyCard
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expoGroups.map((g) => {
              const gAge = aging(g.firstAt);
              return (
              <div key={g.key} className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 flex flex-col">
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
      {stationStrip}
      {allDayPanel}
      {visible.length === 0 ? (
        emptyCard
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((o) => card(o))}
        </div>
      )}
    </div>
  );
}
