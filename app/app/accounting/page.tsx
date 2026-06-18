import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { accountingSummary, resolvePeriod } from "./data";
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
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(sp.period || "this_month", tz, { from: sp.from, to: sp.to });
  const supabase = await createClient();
  const s = await accountingSummary(supabase, business.id, period.startIso, period.endIso);
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
        <a href={exportHref} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-accent shrink-0">
          Export CSV
        </a>
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

      <LockBar currentLock={currentLock} throughDate={lastDay} isOwner={role === "owner"} />

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
    </div>
  );
}
