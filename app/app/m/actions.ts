"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { getTodayBoundsUTC } from "@/lib/utils/dates";

export type LocationLive = {
  id: string;
  name: string;
  net: number;
  orders: number;
  openChecks: number;
  openValue: number;
};

export type RecentSale = { id: string; location: string; label: string; total: number; at: string };

export type Alerts = {
  voids: { n: number; amt: number };
  unassigned: number;
  openDrawers: number;
  staleChecks: number;
  oldestCheckMin: number;
};

export type Snapshot = {
  currency: string;
  locations: LocationLive[];
  totals: { net: number; orders: number; openChecks: number; openValue: number };
  avgTicket: number;
  recent: RecentSale[];
  alerts: Alerts;
};

function num(v: unknown): number {
  return Number(v) || 0;
}

function cartValue(cart: unknown): number {
  const items = (cart as { items?: { unit_price?: unknown; quantity?: unknown }[] } | null)?.items;
  if (!Array.isArray(items)) return 0;
  let sum = 0;
  for (const it of items) sum += num(it.unit_price) * num(it.quantity);
  return Math.round(sum * 100) / 100;
}

export async function liveSnapshot(): Promise<Snapshot> {
  const { business } = await requireBusiness();
  const tz = business.timezone || "America/Toronto";
  const currency = (business.currency || "USD").toUpperCase();
  const startIso = getTodayBoundsUTC(tz).start.toISOString();
  const supabase = await createClient();

  const mine = (await listBusinesses()).filter(
    (b) => b.role === "owner" || b.role === "manager"
  );
  const ids = mine.map((b) => b.id);
  const nameById = new Map(mine.map((b) => [b.id, b.name]));

  const [
    { data: orders },
    { data: refunds },
    { data: tickets },
    { data: recentRows },
    { data: voidEvents },
    { data: openDrawerRows },
    { data: staffCounts },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("business_id, total, status, staff_id")
      .in("business_id", ids)
      .gte("created_at", startIso)
      .neq("status", "voided"),
    supabase
      .from("refunds")
      .select("business_id, amount, status")
      .in("business_id", ids)
      .gte("created_at", startIso),
    supabase.from("open_tickets").select("business_id, cart, opened_at").in("business_id", ids),
    supabase
      .from("orders")
      .select("id, business_id, total, sale_number, created_at, status")
      .in("business_id", ids)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_events")
      .select("metadata")
      .in("business_id", ids)
      .eq("action", "void")
      .gte("created_at", startIso),
    supabase.from("drawer_sessions").select("business_id").in("business_id", ids).eq("status", "open"),
    supabase.from("staff_members").select("business_id").in("business_id", ids).eq("is_active", true),
  ]);

  const agg: Record<string, LocationLive> = {};
  for (const b of mine) agg[b.id] = { id: b.id, name: b.name, net: 0, orders: 0, openChecks: 0, openValue: 0 };

  for (const o of orders ?? []) {
    const a = agg[o.business_id as string];
    if (!a) continue;
    a.net += num(o.total);
    a.orders += 1;
  }
  for (const r of refunds ?? []) {
    if ((r.status as string) === "voided") continue;
    const a = agg[r.business_id as string];
    if (a) a.net -= num(r.amount);
  }
  for (const t of tickets ?? []) {
    const a = agg[t.business_id as string];
    if (!a) continue;
    a.openChecks += 1;
    a.openValue += cartValue(t.cart);
  }

  const locations = Object.values(agg)
    .map((l) => ({ ...l, net: Math.round(l.net * 100) / 100, openValue: Math.round(l.openValue * 100) / 100 }))
    .sort((a, b) => b.net - a.net);

  const totals = locations.reduce(
    (t, l) => ({
      net: Math.round((t.net + l.net) * 100) / 100,
      orders: t.orders + l.orders,
      openChecks: t.openChecks + l.openChecks,
      openValue: Math.round((t.openValue + l.openValue) * 100) / 100,
    }),
    { net: 0, orders: 0, openChecks: 0, openValue: 0 }
  );

  const recent: RecentSale[] = (recentRows ?? []).map((o) => ({
    id: o.id as string,
    location: nameById.get(o.business_id as string) ?? "",
    label: o.sale_number ? "#" + o.sale_number : "Sale",
    total: num(o.total),
    at: o.created_at as string,
  }));

  // Manager alert signals.
  const staffedBiz = new Set((staffCounts ?? []).map((s) => s.business_id as string));
  let unassigned = 0;
  for (const o of orders ?? []) {
    if (!o.staff_id && staffedBiz.has(o.business_id as string)) unassigned++;
  }
  let voidN = 0;
  let voidAmt = 0;
  for (const v of voidEvents ?? []) {
    voidN++;
    const m = v.metadata as { amount?: number } | null;
    if (m && typeof m.amount === "number") voidAmt += m.amount;
  }
  const nowMs = Date.now();
  let staleChecks = 0;
  let oldestMin = 0;
  for (const t of tickets ?? []) {
    const opened = t.opened_at as string | null;
    if (!opened) continue;
    const mins = Math.floor((nowMs - new Date(opened).getTime()) / 60000);
    if (mins >= 90) staleChecks++;
    if (mins > oldestMin) oldestMin = mins;
  }
  const alerts: Alerts = {
    voids: { n: voidN, amt: Math.round(voidAmt * 100) / 100 },
    unassigned,
    openDrawers: (openDrawerRows ?? []).length,
    staleChecks,
    oldestCheckMin: oldestMin,
  };

  return {
    currency,
    locations,
    totals,
    avgTicket: totals.orders > 0 ? Math.round((totals.net / totals.orders) * 100) / 100 : 0,
    recent,
    alerts,
  };
}
