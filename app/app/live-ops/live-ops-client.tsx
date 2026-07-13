"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FloorTicket = {
  id: string;
  label: string;
  ticketType: string | null;
  guests: number;
  channel: string | null;
  openedAt: string;
  checkDropped: boolean;
};
export type FeedOrder = {
  id: string;
  saleNumber: number | null;
  total: number;
  method: string;
  createdAt: string;
};
export type KdsTicket = {
  id: string;
  label: string | null;
  firedAt: string;
  items: { name: string; quantity: number }[];
};

// Status color by how long a check has been open (mirrors the design-token status
// escalation; inlined so the web bundle stays free of the RN token package).
function elapsedMin(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}
function dot(mins: number, dropped: boolean): string {
  if (dropped) return "#2FBF71"; // check dropped → success
  if (mins >= 90) return "#E5484D"; // late
  if (mins >= 60) return "#F5A623"; // warning
  return "#2563EB"; // occupied
}
function fmtMins(mins: number): string {
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}

export function LiveOpsClient({
  businessId,
  currency,
  timezone,
  dayStartIso,
  initialFloor,
  initialKds,
  initialFeed,
  initialSalesTotal,
  initialSalesCount,
}: {
  businessId: string;
  currency: string;
  timezone: string;
  dayStartIso: string;
  initialFloor: FloorTicket[];
  initialKds: KdsTicket[];
  initialFeed: FeedOrder[];
  initialSalesTotal: number;
  initialSalesCount: number;
}) {
  const [floor, setFloor] = useState(initialFloor);
  const [kds, setKds] = useState(initialKds);
  const [feed, setFeed] = useState(initialFeed);
  const [salesTotal, setSalesTotal] = useState(initialSalesTotal);
  const [salesCount, setSalesCount] = useState(initialSalesCount);
  const [now, setNow] = useState(() => Date.parse(dayStartIso) + 0 || 0);
  const [live, setLive] = useState(false);

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const refetchFloor = useCallback(async () => {
    const { data } = await supabase
      .from("open_tickets")
      .select("id, label, ticket_type, guest_count, channel, opened_at, check_dropped_at")
      .eq("business_id", businessId)
      .order("opened_at", { ascending: true });
    setFloor(
      (data ?? []).map((t) => ({
        id: t.id as string,
        label: (t.label as string) || "Ticket",
        ticketType: (t.ticket_type as string | null) ?? null,
        guests: Number(t.guest_count) || 0,
        channel: (t.channel as string | null) ?? null,
        openedAt: t.opened_at as string,
        checkDropped: t.check_dropped_at != null,
      }))
    );
  }, [supabase, businessId]);

  const refetchKds = useCallback(async () => {
    const { data } = await supabase
      .from("kitchen_tickets")
      .select("id, label, items, fired_at, fulfilled_at")
      .eq("business_id", businessId)
      .is("fulfilled_at", null)
      .order("fired_at", { ascending: true });
    setKds(
      (data ?? []).map((k) => {
        const items = Array.isArray(k.items) ? (k.items as Array<{ name?: string; quantity?: number }>) : [];
        return {
          id: k.id as string,
          label: (k.label as string | null) ?? null,
          firedAt: k.fired_at as string,
          items: items.map((it) => ({ name: String(it.name ?? "Item"), quantity: Number(it.quantity) || 1 })),
        };
      })
    );
  }, [supabase, businessId]);

  const refetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, sale_number, total, payment_method, status, created_at, is_training")
      .eq("business_id", businessId)
      .neq("status", "voided")
      .gte("created_at", dayStartIso)
      .order("created_at", { ascending: false });
    const rows = (data ?? []).filter((o) => !o.is_training);
    setFeed(
      rows.slice(0, 15).map((o) => ({
        id: o.id as string,
        saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
        total: Number(o.total) || 0,
        method: (o.payment_method as string | null) ?? "cash",
        createdAt: o.created_at as string,
      }))
    );
    setSalesTotal(Math.round(rows.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100);
    setSalesCount(rows.length);
  }, [supabase, businessId, dayStartIso]);

  useEffect(() => {
    setNow(Date.now());
    const channel = supabase
      .channel("live-ops-" + businessId)
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tickets", filter: "business_id=eq." + businessId }, () => refetchFloor())
      .on("postgres_changes", { event: "*", schema: "public", table: "kitchen_tickets", filter: "business_id=eq." + businessId }, () => refetchKds())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "business_id=eq." + businessId }, () => refetchOrders())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // Safety net: re-sync every 30s and advance the elapsed-time clock.
    const iv = setInterval(() => {
      setNow(Date.now());
      refetchFloor();
      refetchKds();
      refetchOrders();
    }, 30000);

    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [supabase, businessId, refetchFloor, refetchKds, refetchOrders]);

  const avg = salesCount > 0 ? salesTotal / salesCount : 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live operations</h1>
          <p className="text-muted-foreground text-sm mt-1">A live mirror of the floor, kitchen, and sales. Read-only.</p>
        </div>
        <span className={"shrink-0 inline-flex items-center gap-1.5 text-xs font-medium " + (live ? "text-emerald-600" : "text-muted-foreground")}>
          <span className={"w-2 h-2 rounded-full " + (live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>

      {/* Live sales strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Sales today</div>
          <div className="text-2xl font-semibold tabular-nums">{money.format(salesTotal)}</div>
        </div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Orders</div>
          <div className="text-2xl font-semibold tabular-nums">{salesCount}</div>
        </div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Avg ticket</div>
          <div className="text-2xl font-semibold tabular-nums">{money.format(avg)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Floor */}
        <section className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Floor</h2>
            <span className="text-xs text-muted-foreground">{floor.length} open</span>
          </div>
          <div className="space-y-2">
            {floor.length === 0 && <p className="text-sm text-muted-foreground">No open checks.</p>}
            {floor.map((t) => {
              const mins = elapsedMin(t.openedAt, now);
              return (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dot(mins, t.checkDropped) }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.guests > 0 ? t.guests + " guests · " : ""}
                      {t.checkDropped ? "check dropped" : t.channel || t.ticketType || "open"}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground shrink-0">{fmtMins(mins)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* KDS */}
        <section className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Kitchen</h2>
            <span className="text-xs text-muted-foreground">{kds.length} firing</span>
          </div>
          <div className="space-y-2">
            {kds.length === 0 && <p className="text-sm text-muted-foreground">Nothing in the kitchen.</p>}
            {kds.map((k) => {
              const mins = elapsedMin(k.firedAt, now);
              const late = mins >= 18;
              return (
                <div key={k.id} className={"rounded-lg border px-3 py-2 " + (late ? "border-red-500/40 bg-red-500/5" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">{k.label || "Ticket"}</div>
                    <span className={"text-xs tabular-nums shrink-0 " + (late ? "text-red-600 font-medium" : "text-muted-foreground")}>{fmtMins(mins)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {k.items.map((it) => (it.quantity > 1 ? it.quantity + "× " : "") + it.name).join(", ") || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Order feed */}
        <section className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent sales</h2>
            <span className="text-xs text-muted-foreground">today</span>
          </div>
          <div className="space-y-1.5">
            {feed.length === 0 && <p className="text-sm text-muted-foreground">No sales yet today.</p>}
            {feed.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground tabular-nums shrink-0">{timeOf(o.createdAt)}</span>
                <span className="truncate flex-1 text-center text-xs text-muted-foreground">
                  {o.saleNumber != null ? "#" + o.saleNumber : ""} {o.method}
                </span>
                <span className="tabular-nums font-medium shrink-0">{money.format(o.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
