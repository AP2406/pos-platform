"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P1-18 tip pooling. Tips are pooled per day, a configured slice is tipped out
// to support roles (kitchen, bar, busser…), and the remaining server pool is
// split among the servers who worked. All money is computed in integer cents
// with a largest-remainder allocation so the parts sum to the pool to the cent.

export type TipOutRule = { role: string; percent: number };
export type TipSplitMethod = "by_sales" | "by_tips" | "equal";
export type TipPoolSettings = {
  tipouts: TipOutRule[];
  method: TipSplitMethod;
};

const DEFAULT_SETTINGS: TipPoolSettings = { tipouts: [], method: "by_sales" };

function sanitize(raw: unknown): TipPoolSettings {
  const s = (raw ?? {}) as Partial<TipPoolSettings>;
  const method: TipSplitMethod =
    s.method === "by_tips" || s.method === "equal" ? s.method : "by_sales";
  const tipouts: TipOutRule[] = Array.isArray(s.tipouts)
    ? s.tipouts
        .map((r) => ({
          role: String((r as TipOutRule)?.role ?? "").trim().slice(0, 40),
          percent: Math.max(0, Math.min(100, Number((r as TipOutRule)?.percent) || 0)),
        }))
        .filter((r) => r.role.length > 0)
        .slice(0, 12)
    : [];
  return { tipouts, method };
}

export async function getTipPoolSettings(): Promise<TipPoolSettings> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("tip_pool_settings")
    .eq("id", business.id)
    .maybeSingle();
  return sanitize(data?.tip_pool_settings ?? DEFAULT_SETTINGS);
}

export async function saveTipPoolSettings(
  input: TipPoolSettings
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change tip-out rules." };
  }
  const clean = sanitize(input);
  const totalPct = clean.tipouts.reduce((s, r) => s + r.percent, 0);
  if (totalPct >= 100) {
    return { error: "Tip-out percentages must total less than 100%." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ tip_pool_settings: clean })
    .eq("id", business.id);
  if (error) {
    console.error("saveTipPoolSettings:", error);
    return { error: "Could not save the tip-out rules." };
  }
  revalidatePath("/app/tips");
  return { ok: true };
}

export type TipPoolResult = {
  date: string;
  grossTips: number;
  tipouts: { role: string; percent: number; amount: number }[];
  serverPool: number;
  method: TipSplitMethod;
  servers: { staffId: string; name: string; sales: number; ownTips: number; amount: number }[];
  unallocated: number; // server pool that couldn't be assigned (no eligible servers)
  orderCount: number;
};

// Split `poolCents` across `weights` (one per server) by the largest-remainder
// method so the integer-cent parts sum to exactly poolCents. Ties broken by
// index for determinism. If every weight is 0, returns all-zero (caller treats
// the pool as unallocated).
function allocate(poolCents: number, weights: number[]): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  const total = weights.reduce((s, w) => s + w, 0);
  if (n === 0 || total <= 0 || poolCents <= 0) return out;
  const exact = weights.map((w) => (poolCents * w) / total);
  let assigned = 0;
  const rema: { i: number; frac: number }[] = [];
  for (let i = 0; i < n; i++) {
    const fl = Math.floor(exact[i]);
    out[i] = fl;
    assigned += fl;
    rema.push({ i, frac: exact[i] - fl });
  }
  let leftover = poolCents - assigned;
  rema.sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < rema.length && leftover > 0; k++) {
    out[rema[k].i] += 1;
    leftover--;
  }
  return out;
}

const c = (n: number) => Math.round((Number(n) || 0) * 100); // dollars -> cents
const d = (cents: number) => cents / 100; // cents -> dollars

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// Compute the tip pool for one calendar day (YYYY-MM-DD) in the business's
// timezone — matching how the Reports page buckets days.
export async function computeTipPool(date: string): Promise<TipPoolResult | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can run the tip pool." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date." };

  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  // Fetch a UTC window wide enough to cover the local day across any offset,
  // then keep only the orders whose local day matches.
  const start = new Date(date + "T00:00:00.000Z");
  const winStart = new Date(start.getTime() - 24 * 3600 * 1000).toISOString();
  const winEnd = new Date(start.getTime() + 48 * 3600 * 1000).toISOString();

  const supabase = await createClient();

  const { data: bizRow } = await supabase
    .from("businesses")
    .select("tip_pool_settings")
    .eq("id", business.id)
    .maybeSingle();
  const settings = sanitize(bizRow?.tip_pool_settings ?? DEFAULT_SETTINGS);

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total, tip, staff_id, created_at")
    .eq("business_id", business.id)
    .eq("status", "paid")
    .gte("created_at", winStart)
    .lte("created_at", winEnd);
  if (error) {
    console.error("computeTipPool:", error);
    return { error: "Could not load orders for that day." };
  }
  const rows = (orders ?? []).filter((o) => dayKey(o.created_at as string, tz) === date);

  // Gross tips and per-server sales / own-tips, all in cents.
  let grossTipsCents = 0;
  const salesByStaff = new Map<string, number>();
  const tipsByStaff = new Map<string, number>();
  for (const o of rows) {
    const tipCents = c(o.tip as number);
    grossTipsCents += tipCents;
    const sid = (o.staff_id as string | null) ?? null;
    if (sid) {
      salesByStaff.set(sid, (salesByStaff.get(sid) ?? 0) + c(o.total as number));
      tipsByStaff.set(sid, (tipsByStaff.get(sid) ?? 0) + tipCents);
    }
  }

  // Tip-outs: each rule rounded to the nearest cent; the server pool absorbs the
  // residue, so gross = Σ tip-outs + server pool exactly.
  const tipoutCalc = settings.tipouts.map((r) => ({
    role: r.role,
    percent: r.percent,
    amountCents: Math.round((grossTipsCents * r.percent) / 100),
  }));
  const tipoutTotalCents = tipoutCalc.reduce((s, t) => s + t.amountCents, 0);
  const serverPoolCents = Math.max(0, grossTipsCents - tipoutTotalCents);

  // Eligible servers = staff who had attributed orders that day.
  const staffIds = Array.from(new Set([...salesByStaff.keys(), ...tipsByStaff.keys()]));
  const nameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("id, name")
      .eq("business_id", business.id)
      .in("id", staffIds);
    for (const s of staff ?? []) nameById.set(s.id as string, s.name as string);
  }

  const weights = staffIds.map((sid) =>
    settings.method === "equal"
      ? 1
      : settings.method === "by_tips"
        ? tipsByStaff.get(sid) ?? 0
        : salesByStaff.get(sid) ?? 0
  );
  const amounts = allocate(serverPoolCents, weights);
  const allocatedCents = amounts.reduce((s, a) => s + a, 0);

  const servers = staffIds
    .map((sid, i) => ({
      staffId: sid,
      name: nameById.get(sid) ?? "Server",
      sales: d(salesByStaff.get(sid) ?? 0),
      ownTips: d(tipsByStaff.get(sid) ?? 0),
      amount: d(amounts[i]),
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  return {
    date,
    grossTips: d(grossTipsCents),
    tipouts: tipoutCalc.map((t) => ({ role: t.role, percent: t.percent, amount: d(t.amountCents) })),
    serverPool: d(serverPoolCents),
    method: settings.method,
    servers,
    unallocated: d(serverPoolCents - allocatedCents),
    orderCount: rows.length,
  };
}
