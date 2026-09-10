import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { resolvePeriod } from "../data";
import { settlementReconciliation } from "../settlement";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n * 100) / 100).toFixed(2);
}

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "access_reports");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(sp.period || "this_month", tz, { from: sp.from, to: sp.to });
  const supabase = await createClient();
  const report = await settlementReconciliation(supabase, business.id, (business as { settings?: unknown }).settings, period.startIso, period.endIso);

  // Disputes/chargebacks (ingested from Finix webhooks). Resilient if 0076 isn't applied.
  const { data: disputeRows } = await supabase
    .from("finix_disputes")
    .select("id, finix_transfer_id, amount_cents, currency, state, reason, respond_by, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const disputes = (disputeRows ?? []) as Record<string, unknown>[];

  const presets = [
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_quarter", label: "This quarter" },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Card settlement (Finix)</h1>
          <p className="text-muted-foreground text-sm mt-1">Reconcile card sales to settled deposits for {period.label.toLowerCase()}.</p>
        </div>
        <Link href="/app/accounting" className="text-sm text-muted-foreground underline hover:text-foreground shrink-0">Accounting →</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((t) => (
          <Link key={t.key} href={"/app/accounting/settlement?period=" + t.key}
            className={"text-sm rounded-md px-3 py-1.5 border " + (period.key === t.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>
            {t.label}
          </Link>
        ))}
      </div>

      {!report.available ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 text-sm text-muted-foreground">
          {report.reason} <Link href="/app/integrations" className="underline hover:text-foreground">Integrations →</Link>
        </div>
      ) : (
        <>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-5 text-sm mb-4">
            <h2 className="font-semibold mb-2">Reconciliation</h2>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Card sales (our records · {report.cardTxns} txns)</span><span className="tabular-nums">{money(report.cardSales)}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Settled gross (Finix)</span><span className="tabular-nums">{money(report.settledGross)}</span></div>
            <div className={"flex justify-between py-1 " + (Math.abs(report.grossVariance) > 0.01 ? "text-amber-600" : "")}><span>Gross variance</span><span className="tabular-nums">{(report.grossVariance >= 0 ? "+" : "") + money(report.grossVariance)}</span></div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Expected fees (0.15% + $0.15/txn)</span><span className="tabular-nums">{money(report.expectedFees)}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Actual fees (Finix)</span><span className="tabular-nums">{money(report.settledFees)}</span></div>
            <div className={"flex justify-between py-1 " + (Math.abs(report.feeVariance) > 0.01 ? "text-amber-600" : "")}><span>Fee variance</span><span className="tabular-nums">{(report.feeVariance >= 0 ? "+" : "") + money(report.feeVariance)}</span></div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between py-1 font-semibold"><span>Net deposited</span><span className="tabular-nums">{money(report.settledNet)}</span></div>
            <p className="text-[12px] text-muted-foreground mt-2">Expected fees cover processing only; payout-timing fees (instant 1.5% / T+1 $0.75 / T+2 $0.50), disputes ($30) and ACH returns ($5) appear in the actual total. Gross variance is usually timing — sales settle a day or two later.</p>
          </div>

          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
            <div className="px-3 py-2 text-sm font-semibold border-b border-border">Settlement batches</div>
            {report.settlements.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No settlements in this period yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Gross</th>
                    <th className="px-3 py-2 font-medium text-right">Fees</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.settlements.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2">{s.status}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(s.gross)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(s.fees)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(s.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {disputes.length > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden mt-4">
          <div className="px-3 py-2 text-sm font-semibold border-b border-border">Disputes &amp; chargebacks</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Transfer</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id as string} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{d.created_at ? new Date(d.created_at as string).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">{(d.state as string) || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{(d.reason as string) || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{(d.finix_transfer_id as string) || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money((Number(d.amount_cents) || 0) / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
