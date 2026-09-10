import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { computePayroll } from "./data";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "access_reports");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : todayStr;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : new Date(new Date(to + "T00:00:00Z").getTime() - 13 * 86400000).toISOString().slice(0, 10);
  const startIso = new Date(from + "T00:00:00Z").toISOString();
  const endIso = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();

  const supabase = await createClient();
  const rows = await computePayroll(supabase, business.id, startIso, endIso, tz, (business as { settings?: unknown }).settings);
  const currency = (business.currency || "USD").toUpperCase();

  const tot = rows.reduce((t, r) => ({ gross: t.gross + r.grossWages, controlled: t.controlled + r.controlledTips, direct: t.direct + r.directTips, box14: t.box14 + r.box14, cpp: t.cpp + r.estCpp, ei: t.ei + r.estEi }), { gross: 0, controlled: 0, direct: 0, box14: 0, cpp: 0, ei: 0 });
  const qs = "from=" + from + "&to=" + to;

  return (
    <div className="max-w-4xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="text-muted-foreground text-sm mt-1">Per-employee earnings, hours and the controlled-vs-direct tip split for a pay period. Controlled tips (card/electronic) flow to T4 box 14; direct cash tips are the employee&apos;s to declare.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 mb-4">
        <div className="space-y-1"><label className="text-xs text-muted-foreground block">From</label><input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm" /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground block">To</label><input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-border bg-transparent px-2 text-sm" /></div>
        <button className="h-9 rounded-md border border-foreground bg-foreground text-background px-3 text-sm">Apply</button>
        <div className="ml-auto flex gap-2">
          <a href={"/app/accounting/payroll/export?type=t4&" + qs} className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm hover:bg-accent">T4 CSV</a>
          <a href={"/app/accounting/payroll/export?type=roe&" + qs} className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm hover:bg-accent">ROE CSV</a>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">No hours or tips in this period.</div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Hours</th>
                  <th className="px-3 py-2 font-medium text-right">Gross wages</th>
                  <th className="px-3 py-2 font-medium text-right">Controlled tips</th>
                  <th className="px-3 py-2 font-medium text-right">Direct tips</th>
                  <th className="px-3 py-2 font-medium text-right">Box 14</th>
                  <th className="px-3 py-2 font-medium text-right">est. CPP/EI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.staffId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{r.name}{r.rate == null && <span className="block text-[12px] text-amber-600 font-normal">no pay rate</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.regHours.toFixed(1)}{r.otHours > 0 && <span className="text-amber-600"> +{r.otHours.toFixed(1)} OT</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.grossWages, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.controlledTips, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(r.directTips, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{money(r.box14, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(r.estCpp + r.estEi, currency)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(tot.gross, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(tot.controlled, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(tot.direct, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(tot.box14, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(tot.cpp + tot.ei, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[12px] text-muted-foreground border-t border-border">
            CPP/EI are estimates (a guide), not a filing calculation — your payroll provider computes exact deductions, max insurable/pensionable caps and basic exemptions.
          </p>
        </div>
      )}

      {/* F2: payroll-provider feed (behind the flag) */}
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mt-6">
        <h2 className="text-sm font-semibold mb-1">Payroll-provider feed</h2>
        <p className="text-xs text-muted-foreground mb-3">Approved hours + tips per pay period for Wagepoint / Ceridian Dayforce / ADP Canada / Payworks. Download the feed now; direct API push activates once provider credentials are added.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href={"/app/accounting/payroll/export?type=feed&" + qs} className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm hover:bg-accent">Download feed (CSV)</a>
          <button disabled className="h-9 inline-flex items-center rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground cursor-not-allowed" title="Add provider credentials to enable">Push to provider — not connected</button>
        </div>
      </div>
    </div>
  );
}
