import type { createClient } from "@/lib/supabase/server";

// Server-only accounting aggregation (shared by the page + the CSV export).
// Reads existing orders/payments/refunds + gift-card/store-credit balances.
// All money in numeric dollars; tax split comes from the immutable snapshot.

export type TaxLine = { key: string; label: string; rate: number; base: number; amount: number };

export type AccountingSummary = {
  orderCount: number;
  grossSales: number; // sum of non-voided order totals
  netSales: number; // pre-tax subtotal
  discounts: number;
  comps: number;
  serviceCharge: number;
  tips: number;
  taxTotal: number;
  taxableBase: number;
  exemptBase: number;
  taxByRate: TaxLine[];
  voids: { n: number; amount: number };
  refunds: number;
  tenders: { method: string; amount: number }[];
  giftCardOutstanding: number;
  storeCreditOutstanding: number;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function accountingSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string
): Promise<AccountingSummary> {
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, subtotal, tax, tip, discount, comp, service_charge, status, snapshot")
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const rows = orders ?? [];
  const liveIds: string[] = [];

  let grossSales = 0, netSales = 0, discounts = 0, comps = 0, serviceCharge = 0, tips = 0, taxTotal = 0;
  let taxableBase = 0, exemptBase = 0;
  let voidN = 0, voidAmt = 0;
  const taxMap = new Map<string, TaxLine>();

  for (const o of rows) {
    if ((o.status as string) === "voided") {
      voidN++;
      voidAmt += Number(o.total) || 0;
      continue;
    }
    liveIds.push(o.id as string);
    grossSales += Number(o.total) || 0;
    netSales += Number(o.subtotal) || 0;
    discounts += Number(o.discount) || 0;
    comps += Number(o.comp) || 0;
    serviceCharge += Number(o.service_charge) || 0;
    tips += Number(o.tip) || 0;
    taxTotal += Number(o.tax) || 0;

    const snap = (o.snapshot as { tax?: { exempt?: unknown; taxable_base?: number; breakdown?: { rate?: number; label?: string; base?: number; amount?: number }[] } } | null) ?? null;
    const tax = snap?.tax ?? null;
    if (tax) {
      if (tax.exempt) {
        exemptBase += Number(o.subtotal) || 0;
      } else {
        taxableBase += Number(tax.taxable_base) || 0;
      }
      for (const b of tax.breakdown ?? []) {
        const rate = Number(b.rate) || 0;
        const label = (b.label as string) || "Tax";
        const key = label + "@" + rate;
        const line = taxMap.get(key) ?? { key, label, rate, base: 0, amount: 0 };
        line.base += Number(b.base) || 0;
        line.amount += Number(b.amount) || 0;
        taxMap.set(key, line);
      }
    }
  }

  // Tenders for the live orders in range.
  const tenderMap = new Map<string, number>();
  if (liveIds.length > 0) {
    const { data: pays } = await supabase
      .from("payments")
      .select("method, amount")
      .eq("business_id", businessId)
      .in("order_id", liveIds);
    for (const p of pays ?? []) {
      const m = (p.method as string) || "other";
      tenderMap.set(m, (tenderMap.get(m) ?? 0) + (Number(p.amount) || 0));
    }
  }

  // Refunds in range.
  const { data: refundRows } = await supabase
    .from("refunds")
    .select("amount, status")
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  let refunds = 0;
  for (const r of refundRows ?? []) {
    if ((r.status as string) === "voided") continue;
    refunds += Number(r.amount) || 0;
  }

  // Outstanding liabilities (point-in-time).
  const [{ data: gc }, { data: sc }] = await Promise.all([
    supabase.from("gift_cards").select("balance_cents").eq("business_id", businessId).eq("is_active", true),
    supabase.from("store_credit_accounts").select("balance_cents").eq("business_id", businessId),
  ]);
  let giftCardOutstanding = 0;
  for (const g of gc ?? []) giftCardOutstanding += (Number(g.balance_cents) || 0) / 100;
  let storeCreditOutstanding = 0;
  for (const s of sc ?? []) storeCreditOutstanding += (Number(s.balance_cents) || 0) / 100;

  return {
    orderCount: liveIds.length,
    grossSales: r2(grossSales),
    netSales: r2(netSales),
    discounts: r2(discounts),
    comps: r2(comps),
    serviceCharge: r2(serviceCharge),
    tips: r2(tips),
    taxTotal: r2(taxTotal),
    taxableBase: r2(taxableBase),
    exemptBase: r2(exemptBase),
    taxByRate: Array.from(taxMap.values())
      .map((l) => ({ ...l, base: r2(l.base), amount: r2(l.amount) }))
      .sort((a, b) => b.amount - a.amount),
    voids: { n: voidN, amount: r2(voidAmt) },
    refunds: r2(refunds),
    tenders: Array.from(tenderMap.entries()).map(([method, amount]) => ({ method, amount: r2(amount) })),
    giftCardOutstanding: r2(giftCardOutstanding),
    storeCreditOutstanding: r2(storeCreditOutstanding),
  };
}

// Period helpers (calendar month/quarter, in the business timezone, returned as
// UTC ISO bounds [start, end)).
export type Period = { key: string; label: string; startIso: string; endIso: string };

function ymd(d: Date, tz: string): { y: number; m: number; d: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? "0");
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function resolvePeriod(key: string, tz: string, custom?: { from?: string; to?: string }): Period {
  const now = new Date();
  const { y, m } = ymd(now, tz);
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString();
  const addMonth = (yy: number, mm: number, n: number) => {
    const t = mm - 1 + n;
    return { y: yy + Math.floor(t / 12), m: ((t % 12) + 12) % 12 + 1 };
  };

  if (key === "last_month") {
    const p = addMonth(y, m, -1);
    return { key, label: "Last month", startIso: monthStart(p.y, p.m), endIso: monthStart(y, m) };
  }
  if (key === "this_quarter") {
    const qStartMonth = m - ((m - 1) % 3);
    const next = addMonth(y, qStartMonth, 3);
    return { key, label: "This quarter", startIso: monthStart(y, qStartMonth), endIso: monthStart(next.y, next.m) };
  }
  if (key === "custom" && custom?.from && custom?.to) {
    const start = new Date(custom.from + "T00:00:00Z").toISOString();
    const endD = new Date(custom.to + "T00:00:00Z");
    endD.setUTCDate(endD.getUTCDate() + 1);
    return { key, label: custom.from + " → " + custom.to, startIso: start, endIso: endD.toISOString() };
  }
  // default: this month
  const next = addMonth(y, m, 1);
  return { key: "this_month", label: "This month", startIso: monthStart(y, m), endIso: monthStart(next.y, next.m) };
}
