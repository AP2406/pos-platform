import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { accountingSummary, resolvePeriod, comparePeriod } from "./data";
import { primeCostSummary, foodCostVariance } from "./cost";
import { lockedThrough } from "@/lib/services/period-lock";
import { LockBar } from "./lock-bar";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}
const RATE_PCT = (r: number) => (Math.round(r * 10000) / 100).toFixed(2).replace(/\.00$/, "") + "%";
const TENDER_LABEL: Record<string, string> = {
  cash: "Cash", card: "Card", gift_card: "Gift card", store_credit: "Store credit", other: "Other",
};

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; cmp?: string }>;
}) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(sp.period || "this_month", tz, { from: sp.from, to: sp.to });
  const supabase = await createClient();
  const s = await accountingSummary(supabase, business.id, period.startIso, period.endIso);
  const pc = await primeCostSummary(supabase, business.id, period.startIso, period.endIso, s.netSales);
  const fv = await foodCostVariance(supabase, business.id, period.startIso, period.endIso);

  // Period-over-period / YoY comparison (optional).
  const cmpMode = sp.cmp === "prev" || sp.cmp === "yoy" ? sp.cmp : null;
  const cmpPeriod = cmpMode ? comparePeriod(period, cmpMode) : null;
  const cmpS = cmpPeriod ? await accountingSummary(supabase, business.id, cmpPeriod.startIso, cmpPeriod.endIso) : null;
  const cmpPc = cmpPeriod ? await primeCostSummary(supabase, business.id, cmpPeriod.startIso, cmpPeriod.endIso, cmpS!.netSales) : null;
  const delta = (cur: number, prev: number | undefined | null): string | null => {
    if (prev == null) return null;
    const d = cur - prev;
    const pctTxt = prev !== 0 ? " (" + (d >= 0 ? "+" : "") + Math.round((d / Math.abs(prev)) * 1000) / 10 + "%)" : "";
    return (d >= 0 ? "▲ " : "▼ ") + money(Math.abs(d)) + pctTxt + " vs " + (cmpPeriod?.label ?? "");
  };

  const currentLock = await lockedThrough(supabase, business.id);
  const lastDay = (() => {
    const d = new Date(period.endIso);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const presets = [
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_quarter", label: "This quarter" },
  ];

  const exportHref =
    "/app/accounting/export?period=" + period.key +
    (period.key === "custom" && sp.from && sp.to ? "&from=" + sp.from + "&to=" + sp.to : "");

  const Line = ({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) => (
    <div className={"flex justify-between py-1.5 " + (strong ? "font-semibold" : "")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}{sub ? <span className="text-xs text-muted-foreground ml-1">{sub}</span> : null}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Accounting</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sales, GST/HST and tenders for {period.label.toLowerCase()}. Voided sales excluded.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={exportHref} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            Export CSV
          </a>
          <a href={"/app/accounting/journal?" + exportHref.split("?")[1]} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            Journal (QBO/Xero)
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((t) => (
          <Link
            key={t.key}
            href={"/app/accounting?period=" + t.key}
            className={"text-sm rounded-md px-3 py-1.5 border " + (period.key === t.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}
          >
            {t.label}
          </Link>
        ))}
        <form action="/app/accounting" method="get" className="flex items-end gap-1.5">
          <input type="hidden" name="period" value="custom" />
          <input type="date" name="from" defaultValue={sp.from} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" />
          <input type="date" name="to" defaultValue={sp.to} className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" />
          <button className="text-sm rounded-md px-3 py-1.5 border border-border hover:bg-accent">Go</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="text-muted-foreground">Compare to:</span>
        {[
          { key: "", label: "None" },
          { key: "prev", label: "Prior period" },
          { key: "yoy", label: "Last year" },
        ].map((c) => {
          const base = "period=" + period.key + (period.key === "custom" && sp.from && sp.to ? "&from=" + sp.from + "&to=" + sp.to : "");
          const href = "/app/accounting?" + base + (c.key ? "&cmp=" + c.key : "");
          const active = (sp.cmp || "") === c.key || (!c.key && !cmpMode);
          return (
            <Link key={c.label} href={href} className={"rounded-md px-2.5 py-1 border " + (active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>
              {c.label}
            </Link>
          );
        })}
      </div>

      <LockBar currentLock={currentLock} throughDate={lastDay} isOwner={role === "owner"} />

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">Prime cost (P&amp;L)</h2>
          {pc.primeCostPct != null && (
            <span className="text-xs text-muted-foreground">Prime cost {pc.primeCostPct}% of net sales</span>
          )}
        </div>
        <Line label="Net sales (pre-tax)" value={money(s.netSales)} />
        {cmpS && (
          <p className={"text-[11px] -mt-1 mb-1 " + (s.netSales - cmpS.netSales >= 0 ? "text-emerald-600" : "text-red-600")}>{delta(s.netSales, cmpS.netSales)}</p>
        )}
        <Line label="Food cost (COGS)" sub={pc.foodCostPct != null ? pc.foodCostPct + "% of sales" : "set recipes to track"} value={pc.cogs > 0 ? "-" + money(pc.cogs) : money(0)} />
        <Line label="Gross profit" value={money(pc.grossProfit)} strong />
        <Line label="Labor" sub={pc.laborPct != null ? pc.laborPct + "% of sales · " + pc.laborHours.toFixed(1) + " hrs" : undefined} value={pc.laborCost > 0 ? "-" + money(pc.laborCost) : money(0)} />
        <div className="border-t border-border my-1" />
        <Line label="Prime cost (food + labor)" value={money(pc.primeCost)} strong />
        {cmpPc && (
          <p className={"text-[11px] " + (pc.primeCost - cmpPc.primeCost <= 0 ? "text-emerald-600" : "text-red-600")}>{delta(pc.primeCost, cmpPc.primeCost)}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          {pc.coveragePct != null && pc.coveragePct < 99
            ? "Food cost covers " + pc.coveragePct + "% of sales — items without a recipe count as $0 COGS. Add recipes under Catalog → Recipes for a complete figure."
            : "Food cost is theoretical (recipe plate cost × units sold). Labor is clocked hours × pay rate for the period."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm">
          <h2 className="font-semibold mb-2">Sales</h2>
          <Line label="Net sales (pre-tax)" value={money(s.netSales)} />
          <Line label="Discounts" value={s.discounts > 0 ? "-" + money(s.discounts) : money(0)} />
          <Line label="Comps" value={s.comps > 0 ? "-" + money(s.comps) : money(0)} />
          <Line label="Service charge" value={money(s.serviceCharge)} />
          <div className="border-t border-border my-1" />
          <Line label="Tax collected" value={money(s.taxTotal)} />
          <Line label="Tips payable" value={money(s.tips)} />
          <div className="border-t border-border my-1" />
          <Line label={"Gross sales (" + s.orderCount + " sale" + (s.orderCount === 1 ? "" : "s") + ")"} value={money(s.grossSales)} strong />
        </div>

        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm">
          <h2 className="font-semibold mb-2">GST / HST</h2>
          {s.taxByRate.length === 0 ? (
            <p className="text-muted-foreground">No tax collected.</p>
          ) : (
            s.taxByRate.map((t) => (
              <Line key={t.key} label={t.label} sub={RATE_PCT(t.rate) + " on " + money(t.base)} value={money(t.amount)} />
            ))
          )}
          <div className="border-t border-border my-1" />
          <Line label="Taxable base" value={money(s.taxableBase)} />
          <Line label="Exempt / zero-rated" value={money(s.exemptBase)} />
          <Line label="Total tax payable" value={money(s.taxTotal)} strong />
        </div>

        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm">
          <h2 className="font-semibold mb-2">Tenders</h2>
          {s.tenders.length === 0 ? (
            <p className="text-muted-foreground">No tenders.</p>
          ) : (
            s.tenders.map((t) => <Line key={t.method} label={TENDER_LABEL[t.method] ?? t.method} value={money(t.amount)} />)
          )}
          <div className="border-t border-border my-1" />
          <Line label="Refunds (post-tax)" value={s.refunds > 0 ? "-" + money(s.refunds) : money(0)} />
          <Line label={"Voids, pre-tax (" + s.voids.n + ")"} value={s.voids.amount > 0 ? money(s.voids.amount) : money(0)} />
        </div>

        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm">
          <h2 className="font-semibold mb-2">Outstanding liabilities</h2>
          <p className="text-xs text-muted-foreground mb-2">Current balances (not for the period).</p>
          <Line label="Gift cards outstanding" value={money(s.giftCardOutstanding)} />
          <Line label="Store credit outstanding" value={money(s.storeCreditOutstanding)} />
        </div>
      </div>

      {(fv.theoreticalCost > 0 || fv.wasteCost > 0) && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-semibold">Food cost variance</h2>
            {fv.variancePct != null && (
              <span className={"text-xs " + (fv.variancePct > 5 ? "text-red-600" : "text-muted-foreground")}>Waste is {fv.variancePct}% over theoretical</span>
            )}
          </div>
          <Line label="Theoretical (recipe usage on sales)" value={money(fv.theoreticalCost)} />
          <Line label="Waste (logged)" value={fv.wasteCost > 0 ? "+" + money(fv.wasteCost) : money(0)} />
          <div className="border-t border-border my-1" />
          <Line label="Actual food cost (theoretical + waste)" value={money(fv.actualCost)} strong />
          {fv.rows.filter((r) => r.wasteCost > 0).length > 0 && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Top waste by cost</div>
              {fv.rows.filter((r) => r.wasteCost > 0).slice(0, 6).map((r) => (
                <div key={r.ingredientId} className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">{r.name}<span className="text-xs ml-1">{r.wasteQty} {r.unit}</span></span>
                  <span className="tabular-nums">{money(r.wasteCost)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Theoretical = recipe ingredients consumed by what sold. Variance is logged waste; an actual count beyond this needs inventory counts. Log waste under Catalog → Waste.
          </p>
        </div>
      )}
    </div>
  );
}
