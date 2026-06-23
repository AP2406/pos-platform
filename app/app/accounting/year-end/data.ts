import type { createClient } from "@/lib/supabase/server";
import { accountingSummary } from "../data";
import { primeCostSummary } from "../cost";
import { buildJournal, resolveCoa, compDiscountAccount, type CoaKey } from "../journal";

// F9/F13: a trial balance for a period = the sales DSJE (computed from orders) +
// every manual/system journal line, aggregated by account. Numeric dollars.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type TBRow = { account: string; code: string; debit: number; credit: number; net: number };

export function fiscalYearBounds(startYear: number, startMonth: number): { startIso: string; endIso: string; label: string } {
  const m = Math.min(12, Math.max(1, startMonth));
  const start = new Date(Date.UTC(startYear, m - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, m - 1, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString(), label: "FY " + startYear + (m === 1 ? "" : "/" + (startYear + 1)) };
}

async function contraFromAudit(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string, startIso: string, endIso: string) {
  const { data } = await supabase
    .from("audit_events").select("action, metadata, reason_code")
    .eq("business_id", businessId).in("action", ["comp", "discount"]).gte("created_at", startIso).lt("created_at", endIso);
  const map = new Map<CoaKey, number>();
  for (const e of data ?? []) {
    const amt = Number((e.metadata as { amount?: number } | null)?.amount) || 0;
    if (amt <= 0) continue;
    const key = compDiscountAccount(e.action as "comp" | "discount", (e.reason_code as string | null) ?? null);
    map.set(key, (map.get(key) ?? 0) + amt);
  }
  return Array.from(map.entries()).map(([key, amount]) => ({ key, amount: r2(amount) }));
}

export async function trialBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string,
  settings: unknown
): Promise<TBRow[]> {
  const s = await accountingSummary(supabase, businessId, startIso, endIso);
  const pc = await primeCostSummary(supabase, businessId, startIso, endIso, s.netSales);
  const coa = resolveCoa(settings);
  const contra = await contraFromAudit(supabase, businessId, startIso, endIso);
  const dsje = buildJournal(s, pc.cogs, coa, "DSJE", contra);

  // Manual / system journal lines dated in the period.
  const { data: entries } = await supabase
    .from("journal_entries").select("id").eq("business_id", businessId)
    .gte("entry_date", startIso.slice(0, 10)).lt("entry_date", endIso.slice(0, 10));
  const ids = (entries ?? []).map((e) => e.id as string);
  const manual: { account_name: string; account_code: string | null; debit: number; credit: number }[] = [];
  if (ids.length > 0) {
    const { data: lines } = await supabase.from("journal_lines").select("account_name, account_code, debit, credit").in("entry_id", ids);
    for (const l of lines ?? []) manual.push({ account_name: l.account_name as string, account_code: (l.account_code as string | null) ?? null, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 });
  }

  const agg = new Map<string, TBRow>();
  const add = (account: string, code: string, debit: number, credit: number) => {
    const key = code + "|" + account;
    const row = agg.get(key) ?? { account, code, debit: 0, credit: 0, net: 0 };
    row.debit += debit; row.credit += credit; agg.set(key, row);
  };
  for (const l of dsje) add(l.account, l.code, l.debit, l.credit);
  for (const l of manual) add(l.account_name, l.account_code ?? "", l.debit, l.credit);

  return Array.from(agg.values())
    .map((r) => ({ account: r.account, code: r.code, debit: r2(r.debit), credit: r2(r.credit), net: r2(r.debit - r.credit) }))
    .filter((r) => r.debit !== 0 || r.credit !== 0)
    .sort((a, b) => (a.code || "zzz").localeCompare(b.code || "zzz"));
}
