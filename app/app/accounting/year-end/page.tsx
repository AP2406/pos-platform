import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { ChevronLeft } from "lucide-react";
import { lockedThrough } from "@/lib/services/period-lock";
import { trialBalance, fiscalYearBounds } from "./data";
import { computePayroll } from "../payroll/data";
import { YearEndControls } from "./year-end-controls";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.round((Number(n) || 0) * 100) / 100);
}

export default async function YearEndPage({ searchParams }: { searchParams: Promise<{ fy?: string }> }) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "access_reports");
  if (!hasFloorService(business)) redirect("/app/reports");

  const settings = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const startMonth = Number(settings.fiscal_year_start) >= 1 && Number(settings.fiscal_year_start) <= 12 ? Number(settings.fiscal_year_start) : 1;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const nowYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric" }).format(new Date()));
  const sp = await searchParams;
  const fyYear = /^\d{4}$/.test(sp.fy || "") ? Number(sp.fy) : nowYear;
  const fy = fiscalYearBounds(fyYear, startMonth);
  const currency = (business.currency || "USD").toUpperCase();

  const supabase = await createClient();
  const [tb, payroll, gc, sc, locked] = await Promise.all([
    trialBalance(supabase, business.id, fy.startIso, fy.endIso, settings),
    computePayroll(supabase, business.id, fy.startIso, fy.endIso, tz, settings),
    supabase.from("gift_cards").select("balance_cents").eq("business_id", business.id).eq("is_active", true),
    supabase.from("store_credit_accounts").select("balance_cents").eq("business_id", business.id),
    lockedThrough(supabase, business.id),
  ]);

  const totDebit = tb.reduce((s, r) => s + r.debit, 0);
  const totCredit = tb.reduce((s, r) => s + r.credit, 0);
  const giftBal = (gc.data ?? []).reduce((s, g) => s + (Number(g.balance_cents) || 0) / 100, 0);
  const scBal = (sc.data ?? []).reduce((s, x) => s + (Number(x.balance_cents) || 0) / 100, 0);
  const controlledTips = payroll.reduce((s, r) => s + r.controlledTips, 0);
  const directTips = payroll.reduce((s, r) => s + r.directTips, 0);
  const fyEndDate = new Date(new Date(fy.endIso).getTime() - 86400000).toISOString().slice(0, 10);
  const fyLocked = !!locked && locked >= fyEndDate;
  const qs = "from=" + fy.startIso.slice(0, 10) + "&to=" + fyEndDate;

  return (
    <div className="max-w-3xl">
      <Link href="/app/accounting" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Accounting
      </Link>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Year-end close</h1>
        <p className="text-muted-foreground text-sm mt-1">{fy.label} · {fy.startIso.slice(0, 10)} → {fyEndDate}. Trial balance, roll-forwards and tip recon for your accountant; close locks the books.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[fyYear - 1, fyYear, fyYear + 1 <= nowYear ? fyYear + 1 : fyYear].filter((y, i, a) => a.indexOf(y) === i).map((y) => (
          <Link key={y} href={"/app/accounting/year-end?fy=" + y} className={"text-sm rounded-md px-3 py-1.5 border " + (y === fyYear ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>FY {y}</Link>
        ))}
        <div className="ml-auto flex gap-2">
          <a href={"/app/accounting/audit-export?type=register&" + qs} className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm hover:bg-accent">Audit register CSV</a>
          <a href={"/app/accounting/audit-export?type=tb&" + qs} className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm hover:bg-accent">Trial balance CSV</a>
        </div>
      </div>

      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4">
        <YearEndControls startMonth={startMonth} fyEndDate={fyEndDate} alreadyLocked={fyLocked} isOwner={role === "owner"} />
      </div>

      {/* Trial balance */}
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden mb-4">
        <div className="px-3 py-2 border-b border-border text-sm font-semibold flex items-center justify-between">
          <span>Trial balance</span>
          <span className={"text-xs " + (Math.abs(totDebit - totCredit) < 0.01 ? "text-emerald-600" : "text-red-600")}>{Math.abs(totDebit - totCredit) < 0.01 ? "balanced ✓" : "out of balance"}</span>
        </div>
        {tb.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No activity in this fiscal year.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium text-right">Debit</th>
                <th className="px-3 py-2 font-medium text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {tb.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5">{r.code ? r.code + " · " : ""}{r.account}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.debit ? money(r.debit, currency) : ""}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.credit ? money(r.credit, currency) : ""}</td>
                </tr>
              ))}
              <tr className="bg-muted/30 font-medium">
                <td className="px-3 py-1.5">Total</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(totDebit, currency)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(totCredit, currency)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Lead schedules */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 text-sm">
          <h2 className="font-semibold mb-2">Roll-forwards (closing)</h2>
          <Row label="Gift card liability" value={money(giftBal, currency)} />
          <Row label="Store credit liability" value={money(scBal, currency)} />
        </div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 text-sm">
          <h2 className="font-semibold mb-2">Tip reconciliation</h2>
          <Row label="Controlled (T4 box 14)" value={money(controlledTips, currency)} />
          <Row label="Direct (employee-declared)" value={money(directTips, currency)} />
          <Row label="Total tips" value={money(controlledTips + directTips, currency)} strong />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={"flex justify-between py-1 " + (strong ? "font-semibold border-t border-border mt-1 pt-1" : "")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
