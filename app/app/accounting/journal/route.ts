import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { canAccess } from "@/lib/services/route-access";
import { createClient } from "@/lib/supabase/server";
import { accountingSummary, resolvePeriod } from "../data";
import { primeCostSummary } from "../cost";
import { buildJournal, resolveCoa, compDiscountAccount, type CoaKey } from "../journal";

export const dynamic = "force-dynamic";

// Double-entry journal (DSJE) CSV for QBO / Xero import.
// Columns: Date, Account, Account Code, Debit, Credit, Memo.
export async function GET(request: Request) {
  const { business, role } = await requireBusiness();
  if (!canAccess(role, "export_data")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(url.searchParams.get("period") || "this_month", tz, {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });
  const supabase = await createClient();
  const s = await accountingSummary(supabase, business.id, period.startIso, period.endIso);
  const pc = await primeCostSummary(supabase, business.id, period.startIso, period.endIso, s.netSales);
  const coa = resolveCoa((business as { settings?: unknown }).settings);

  // Entry date = the period's last day (the journal posts as of period end).
  const end = new Date(period.endIso);
  end.setUTCDate(end.getUTCDate() - 1);
  const dateStr = end.toISOString().slice(0, 10);
  const memo = "DSJE " + period.label + " — " + business.name;

  // F10: split comps/discounts by reason into their mapped contra accounts.
  const { data: cdRows } = await supabase
    .from("audit_events")
    .select("action, metadata, reason_code")
    .eq("business_id", business.id)
    .in("action", ["comp", "discount"])
    .gte("created_at", period.startIso)
    .lt("created_at", period.endIso);
  const contraMap = new Map<CoaKey, number>();
  for (const e of cdRows ?? []) {
    const action = e.action as "comp" | "discount";
    const amt = Number((e.metadata as { amount?: number } | null)?.amount) || 0;
    if (amt <= 0) continue;
    const key = compDiscountAccount(action, (e.reason_code as string | null) ?? null);
    contraMap.set(key, (contraMap.get(key) ?? 0) + amt);
  }
  const contra = Array.from(contraMap.entries()).map(([key, amount]) => ({ key, amount: Math.round(amount * 100) / 100 }));

  const lines = buildJournal(s, pc.cogs, coa, memo, contra);

  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
  const n = (x: number) => (x ? (Math.round(x * 100) / 100).toFixed(2) : "");
  const out: string[] = [];
  out.push(["Date", "Account", "Account Code", "Debit", "Credit", "Memo"].map(esc).join(","));
  let td = 0, tc = 0;
  for (const l of lines) {
    td += l.debit; tc += l.credit;
    out.push([dateStr, l.account, l.code, n(l.debit), n(l.credit), l.memo].map(esc).join(","));
  }
  // Totals row (sanity — debits should equal credits).
  out.push([dateStr, "TOTAL", "", n(Math.round(td * 100) / 100), n(Math.round(tc * 100) / 100), "Debits must equal credits"].map(esc).join(","));

  const csv = out.join("\r\n");
  const fname = "journal-" + period.key + ".csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + fname + '"',
    },
  });
}
