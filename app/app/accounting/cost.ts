import type { createClient } from "@/lib/supabase/server";

// Prime-cost / P&L helpers — COGS (theoretical food cost from recipes) + labor
// for a period, layered on top of the existing accountingSummary. All money in
// numeric dollars. Items without a defined recipe contribute $0 COGS, so we also
// report how much of net sales is "covered" by a recipe (the honesty caveat).

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type PrimeCost = {
  cogs: number; // theoretical food cost of items sold (recipe plate cost × qty)
  coveredSales: number; // net sales from items that HAVE a recipe
  laborCost: number;
  laborHours: number;
  grossProfit: number; // netSales − cogs
  primeCost: number; // cogs + labor
  foodCostPct: number | null; // cogs / netSales
  laborPct: number | null; // labor / netSales
  primeCostPct: number | null; // (cogs + labor) / netSales
  coveragePct: number | null; // coveredSales / netSales (recipe coverage)
};

// Per-catalog-item plate cost = Σ (recipe ingredient qty × ingredient unit cost).
export async function plateCostByItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<Map<string, number>> {
  const [{ data: ri }, { data: ing }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("catalog_item_id, ingredient_id, quantity")
      .eq("business_id", businessId),
    supabase.from("ingredients").select("id, cost").eq("business_id", businessId),
  ]);
  const unitCost = new Map<string, number>();
  for (const i of ing ?? []) unitCost.set(i.id as string, Number(i.cost) || 0);
  const plate = new Map<string, number>();
  for (const r of ri ?? []) {
    const c = (Number(r.quantity) || 0) * (unitCost.get(r.ingredient_id as string) || 0);
    plate.set(r.catalog_item_id as string, (plate.get(r.catalog_item_id as string) || 0) + c);
  }
  return plate;
}

// Labor cost for [startIso, endIso): each clock entry prorated to its overlap
// with the window × the staff member's pay rate. Open shifts run to "now".
async function laborForPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string
): Promise<{ cost: number; hours: number }> {
  const [{ data: staff }, { data: clocks }] = await Promise.all([
    supabase.from("staff_members").select("id, pay_rate").eq("business_id", businessId),
    supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out")
      .eq("business_id", businessId)
      .lt("clock_in", endIso)
      .or(`clock_out.gte.${startIso},clock_out.is.null`),
  ]);
  const rate = new Map<string, number | null>();
  for (const s of staff ?? []) rate.set(s.id as string, s.pay_rate != null ? Number(s.pay_rate) : null);

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const now = Date.now();
  let cost = 0;
  let hours = 0;
  for (const c of clocks ?? []) {
    const ci = c.clock_in as string | null;
    if (!ci) continue;
    const inMs = new Date(ci).getTime();
    const outMs = c.clock_out ? new Date(c.clock_out as string).getTime() : now;
    const overlap = Math.min(outMs, endMs) - Math.max(inMs, startMs);
    if (overlap <= 0) continue;
    const hrs = overlap / 3600000;
    hours += hrs;
    const rt = rate.get(c.staff_id as string);
    if (rt != null) cost += hrs * rt;
  }
  return { cost: r2(cost), hours: Math.round(hours * 100) / 100 };
}

// Theoretical (recipe-driven sales usage) vs actual (sales + logged waste) food
// cost over [startIso, endIso), valued at ingredient unit cost. The variance is
// the waste — depletion beyond what the recipes implied for what was sold.
export type VarianceRow = {
  ingredientId: string;
  name: string;
  unit: string;
  salesQty: number;
  wasteQty: number;
  theoreticalCost: number;
  wasteCost: number;
};
export type FoodVariance = {
  rows: VarianceRow[];
  theoreticalCost: number;
  wasteCost: number;
  actualCost: number;
  variancePct: number | null;
};

export async function foodCostVariance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string
): Promise<FoodVariance> {
  const [{ data: ing }, { data: sales }, { data: waste }] = await Promise.all([
    supabase.from("ingredients").select("id, name, unit, cost").eq("business_id", businessId),
    supabase
      .from("ingredient_movements")
      .select("ingredient_id, change")
      .eq("business_id", businessId)
      .eq("reason", "sale")
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("waste_events")
      .select("ingredient_id, quantity")
      .eq("business_id", businessId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const meta = new Map<string, { name: string; unit: string; cost: number }>();
  for (const i of ing ?? []) meta.set(i.id as string, { name: (i.name as string) || "Ingredient", unit: (i.unit as string) || "", cost: Number(i.cost) || 0 });

  const salesQty = new Map<string, number>();
  for (const m of sales ?? []) {
    const id = m.ingredient_id as string;
    salesQty.set(id, (salesQty.get(id) || 0) - (Number(m.change) || 0)); // change is negative on sale
  }
  const wasteQty = new Map<string, number>();
  for (const w of waste ?? []) {
    const id = w.ingredient_id as string;
    wasteQty.set(id, (wasteQty.get(id) || 0) + (Number(w.quantity) || 0));
  }

  const ids = new Set<string>([...salesQty.keys(), ...wasteQty.keys()]);
  let theoreticalCost = 0;
  let wasteCost = 0;
  const rows: VarianceRow[] = [];
  for (const id of ids) {
    const m = meta.get(id) ?? { name: "Ingredient", unit: "", cost: 0 };
    const sq = r2(salesQty.get(id) || 0);
    const wq = r2(wasteQty.get(id) || 0);
    const tc = r2(sq * m.cost);
    const wc = r2(wq * m.cost);
    theoreticalCost += tc;
    wasteCost += wc;
    rows.push({ ingredientId: id, name: m.name, unit: m.unit, salesQty: sq, wasteQty: wq, theoreticalCost: tc, wasteCost: wc });
  }
  rows.sort((a, b) => b.wasteCost - a.wasteCost);
  theoreticalCost = r2(theoreticalCost);
  wasteCost = r2(wasteCost);
  return {
    rows,
    theoreticalCost,
    wasteCost,
    actualCost: r2(theoreticalCost + wasteCost),
    variancePct: theoreticalCost > 0 ? Math.round((wasteCost / theoreticalCost) * 1000) / 10 : null,
  };
}

export async function primeCostSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string,
  netSales: number
): Promise<PrimeCost> {
  const plate = await plateCostByItem(supabase, businessId);

  // Voided orders in range → exclude their items from COGS.
  const { data: voidedOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "voided")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  const voided = new Set((voidedOrders ?? []).map((o) => o.id as string));

  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, catalog_item_id, quantity, unit_price")
    .eq("business_id", businessId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  let cogs = 0;
  let coveredSales = 0;
  for (const it of items ?? []) {
    if (voided.has(it.order_id as string)) continue;
    const cid = it.catalog_item_id as string | null;
    if (!cid || !plate.has(cid)) continue; // no recipe → not counted toward COGS/coverage
    const qty = Number(it.quantity) || 0;
    cogs += (plate.get(cid) || 0) * qty;
    coveredSales += (Number(it.unit_price) || 0) * qty;
  }
  cogs = r2(cogs);
  coveredSales = r2(coveredSales);

  const labor = await laborForPeriod(supabase, businessId, startIso, endIso);
  const pct = (n: number) => (netSales > 0 ? Math.round((n / netSales) * 1000) / 10 : null);

  return {
    cogs,
    coveredSales,
    laborCost: labor.cost,
    laborHours: labor.hours,
    grossProfit: r2(netSales - cogs),
    primeCost: r2(cogs + labor.cost),
    foodCostPct: pct(cogs),
    laborPct: pct(labor.cost),
    primeCostPct: pct(cogs + labor.cost),
    coveragePct: pct(coveredSales),
  };
}
