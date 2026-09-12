import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { primeCostSummary } from "../accounting/cost";

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
];

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business } = await requireBusiness();
  const currency = (business.currency || "USD").toUpperCase();
  const supabase = await createClient();

  const sp = await searchParams;
  const range = RANGES.find((r) => r.key === sp?.range) ?? RANGES[0];
  const since = new Date(Date.now() - range.days * 86400000).toISOString();

  // Locations the owner/manager can report on.
  const mine = (await listBusinesses()).filter(
    (b) => b.role === "owner" || b.role === "manager"
  );
  if (mine.length === 0) redirect("/app/reports");

  const ids = mine.map((b) => b.id);

  const [{ data: orderRows }, { data: refundRows }] = await Promise.all([
    supabase
      .from("orders")
      .select("business_id, subtotal, tip, total, status, created_at")
      .in("business_id", ids)
      .gte("created_at", since),
    supabase
      .from("refunds")
      .select("business_id, amount, status, created_at")
      .in("business_id", ids)
      .gte("created_at", since),
  ]);

  // Aggregate per business (exclude voided sales, matching the per-location report).
  const agg: Record<string, { count: number; gross: number; tips: number; collected: number; refunds: number }> = {};
  for (const b of ids) agg[b] = { count: 0, gross: 0, tips: 0, collected: 0, refunds: 0 };
  for (const o of orderRows ?? []) {
    if ((o.status as string) === "voided") continue;
    const a = agg[o.business_id as string];
    if (!a) continue;
    a.count += 1;
    a.gross += Number(o.subtotal) || 0;
    a.tips += Number(o.tip) || 0;
    a.collected += Number(o.total) || 0;
  }
  for (const r of refundRows ?? []) {
    if ((r.status as string) === "voided") continue;
    const a = agg[r.business_id as string];
    if (!a) continue;
    a.refunds += Number(r.amount) || 0;
  }

  const rows = mine
    .map((b) => {
      const a = agg[b.id];
      const net = round2(a.collected - a.refunds);
      return {
        id: b.id,
        name: b.name,
        count: a.count,
        gross: round2(a.gross),
        tips: round2(a.tips),
        refunds: round2(a.refunds),
        net,
        avg: a.count > 0 ? round2(a.collected / a.count) : 0,
      };
    })
    .sort((x, y) => y.net - x.net);

  const totals = rows.reduce(
    (t, r) => ({
      count: t.count + r.count,
      gross: round2(t.gross + r.gross),
      tips: round2(t.tips + r.tips),
      refunds: round2(t.refunds + r.refunds),
      net: round2(t.net + r.net),
    }),
    { count: 0, gross: 0, tips: 0, refunds: 0, net: 0 }
  );

  // C5: consolidated prime-cost P&L + league table. For each location compute
  // COGS (recipe-driven), labor, and the cost ratios over pre-tax sales (gross
  // subtotal), then rank to surface the outliers. RLS already limits `ids` to
  // locations this owner/manager belongs to, so per-location queries are safe.
  const primeByBiz = new Map<string, Awaited<ReturnType<typeof primeCostSummary>>>();
  await Promise.all(
    ids.map(async (bid) => {
      const base = agg[bid]?.gross ?? 0; // pre-tax sales = subtotal sum
      primeByBiz.set(bid, await primeCostSummary(supabase, bid, since, new Date().toISOString(), base));
    })
  );
  const pnlRows = rows
    .map((r) => {
      const p = primeByBiz.get(r.id);
      const splh = p && p.laborHours > 0 ? round2(r.gross / p.laborHours) : null;
      return {
        id: r.id,
        name: r.name,
        sales: r.gross,
        cogs: p?.cogs ?? 0,
        labor: p?.laborCost ?? 0,
        foodPct: p?.foodCostPct ?? null,
        laborPct: p?.laborPct ?? null,
        primePct: p?.primeCostPct ?? null,
        coverage: p?.coveragePct ?? null,
        splh,
      };
    })
    .filter((r) => r.sales > 0)
    .sort((a, b) => (a.primePct ?? 999) - (b.primePct ?? 999));

  const tCogs = round2(pnlRows.reduce((s, r) => s + r.cogs, 0));
  const tLabor = round2(pnlRows.reduce((s, r) => s + r.labor, 0));
  const tSales = round2(pnlRows.reduce((s, r) => s + r.sales, 0));
  const tFoodPct = tSales > 0 ? round2((tCogs / tSales) * 1000) / 10 : null;
  const tLaborPct = tSales > 0 ? round2((tLabor / tSales) * 1000) / 10 : null;
  const tPrimePct = tSales > 0 ? round2(((tCogs + tLabor) / tSales) * 1000) / 10 : null;
  const minCoverage = pnlRows.reduce((m, r) => (r.coverage != null ? Math.min(m, r.coverage) : m), 100);
  const pctStr = (n: number | null) => (n == null ? "—" : n.toFixed(1) + "%");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">All locations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Combined sales across your {mine.length} locations, last {range.label}. Voided sales excluded.
          </p>
        </div>
        <Link
          href="/app/reports"
          className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
        >
          This location
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={"/app/locations?range=" + r.key}
            className={
              "px-3 py-1.5 text-sm rounded-md border transition-colors " +
              (r.key === range.key
                ? "border-foreground bg-accent font-medium"
                : "border-border hover:border-foreground/40")
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Net sales" value={money(totals.net, currency)} />
        <Stat label="Orders" value={String(totals.count)} />
        <Stat label="Tips" value={money(totals.tips, currency)} />
        <Stat label="Refunds" value={money(totals.refunds, currency)} tone={totals.refunds > 0 ? "warning" : undefined} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
          <div className="col-span-4">Location</div>
          <div className="col-span-2 text-right">Orders</div>
          <div className="col-span-2 text-right">Gross</div>
          <div className="col-span-2 text-right">Refunds</div>
          <div className="col-span-2 text-right">Net</div>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center border-b border-border last:border-0">
            <div className="col-span-4 min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground">Avg {money(r.avg, currency)}</div>
            </div>
            <div className="col-span-2 text-right tabular-nums">{r.count}</div>
            <div className="col-span-2 text-right tabular-nums text-muted-foreground">{money(r.gross, currency)}</div>
            <div className="col-span-2 text-right tabular-nums">{r.refunds > 0 ? money(r.refunds, currency) : "—"}</div>
            <div className="col-span-2 text-right tabular-nums font-medium">{money(r.net, currency)}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Net = collected total minus refunds. Amounts shown in {currency}; locations on a different
        currency are combined at face value.
      </p>

      {pnlRows.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-1">Prime-cost P&amp;L by location</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Food cost (from recipes), labor, and prime cost as a share of pre-tax sales, last {range.label}. Ranked best prime cost first.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Combined food %" value={pctStr(tFoodPct)} />
            <Stat label="Combined labor %" value={pctStr(tLaborPct)} />
            <Stat label="Combined prime %" value={pctStr(tPrimePct)} tone={tPrimePct != null && tPrimePct > 65 ? "warning" : undefined} />
            <Stat label="COGS + labor" value={money(round2(tCogs + tLabor), currency)} />
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
              <div className="col-span-4">Location</div>
              <div className="col-span-2 text-right">Food %</div>
              <div className="col-span-2 text-right">Labor %</div>
              <div className="col-span-2 text-right">Prime %</div>
              <div className="col-span-2 text-right">SPLH</div>
            </div>
            {pnlRows.map((r, i) => {
              const best = i === 0 && pnlRows.length > 1;
              const worst = i === pnlRows.length - 1 && pnlRows.length > 1;
              return (
                <div key={r.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center border-b border-border last:border-0">
                  <div className="col-span-4 min-w-0">
                    <div className="font-medium truncate">
                      {r.name}
                      {best && <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">best</span>}
                      {worst && <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 font-semibold">watch</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{money(r.sales, currency)} sales · {money(round2(r.cogs + r.labor), currency)} prime</div>
                  </div>
                  <div className="col-span-2 text-right tabular-nums">{pctStr(r.foodPct)}</div>
                  <div className="col-span-2 text-right tabular-nums">{pctStr(r.laborPct)}</div>
                  <div className={"col-span-2 text-right tabular-nums font-medium " + (r.primePct != null && r.primePct > 65 ? "text-amber-600" : "")}>{pctStr(r.primePct)}</div>
                  <div className="col-span-2 text-right tabular-nums">{r.splh != null ? money(r.splh, currency) : "—"}</div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Percentages are of pre-tax sales. Food cost only counts items with a defined recipe
            {minCoverage < 100 ? ` (recipe coverage as low as ${Math.round(minCoverage)}% at one location — add recipes for a fuller picture).` : "."}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums mt-0.5 " + (tone === "warning" ? "text-amber-600" : "")}>
        {value}
      </div>
    </div>
  );
}
