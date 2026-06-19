import type { AccountingSummary } from "./data";

// Double-entry Daily Sales Journal Entry (DSJE) for QBO/Xero import. We post one
// balanced summary entry for the period: tenders (debits) against revenue, tax,
// tips and service charge (credits); a clearing line absorbs any rounding/tip
// mismatch; COGS and refunds post as their own balanced pairs. Account codes come
// from the business's chart-of-accounts mapping (settings.coa), else our defaults.

export type CoaKey =
  | "sales" | "service_charge" | "tax_payable" | "tips_payable"
  | "cash" | "card" | "gift_card" | "store_credit" | "other"
  | "cogs" | "inventory" | "sales_returns" | "clearing";

export const COA_DEFAULTS: Record<CoaKey, { name: string; code: string }> = {
  sales: { name: "Food & beverage sales", code: "4000" },
  service_charge: { name: "Service charge income", code: "4100" },
  tax_payable: { name: "GST/HST payable", code: "2200" },
  tips_payable: { name: "Tips payable", code: "2300" },
  cash: { name: "Cash", code: "1000" },
  card: { name: "Card clearing", code: "1010" },
  gift_card: { name: "Gift card liability", code: "2400" },
  store_credit: { name: "Store credit liability", code: "2410" },
  other: { name: "Other tender clearing", code: "1020" },
  cogs: { name: "Cost of goods sold", code: "5000" },
  inventory: { name: "Inventory", code: "1200" },
  sales_returns: { name: "Sales returns & refunds", code: "4900" },
  clearing: { name: "Over/short clearing", code: "9999" },
};

export type Coa = Record<CoaKey, { name: string; code: string }>;

export function resolveCoa(settings: unknown): Coa {
  const stored = ((settings as { coa?: Record<string, { name?: string; code?: string }> } | null)?.coa) ?? {};
  const out = {} as Coa;
  for (const key of Object.keys(COA_DEFAULTS) as CoaKey[]) {
    const d = COA_DEFAULTS[key];
    const s = stored[key] ?? {};
    out[key] = { name: (s.name && s.name.trim()) || d.name, code: (s.code && s.code.trim()) || d.code };
  }
  return out;
}

export type JournalLine = { account: string; code: string; debit: number; credit: number; memo: string };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const TENDER_KEY: Record<string, CoaKey> = {
  cash: "cash", card: "card", gift_card: "gift_card", store_credit: "store_credit", other: "other",
};

export function buildJournal(
  s: AccountingSummary,
  cogs: number,
  coa: Coa,
  memo: string
): JournalLine[] {
  const lines: JournalLine[] = [];
  const debit = (k: CoaKey, amt: number) => { if (r2(amt) !== 0) lines.push({ account: coa[k].name, code: coa[k].code, debit: r2(amt), credit: 0, memo }); };
  const credit = (k: CoaKey, amt: number) => { if (r2(amt) !== 0) lines.push({ account: coa[k].name, code: coa[k].code, debit: 0, credit: r2(amt), memo }); };

  // Receipts (debits) — what was collected, by tender.
  let totalDebit = 0;
  for (const t of s.tenders) {
    const k = TENDER_KEY[t.method] ?? "other";
    debit(k, t.amount);
    totalDebit += t.amount;
  }
  // Revenue / liabilities (credits).
  let totalCredit = 0;
  const addCredit = (k: CoaKey, amt: number) => { credit(k, amt); totalCredit += amt; };
  addCredit("sales", s.netSales);
  addCredit("service_charge", s.serviceCharge);
  addCredit("tax_payable", s.taxTotal);
  addCredit("tips_payable", s.tips);

  // Balancing line for rounding / tip-vs-total mismatch.
  const diff = r2(totalCredit - totalDebit);
  if (diff > 0) debit("clearing", diff);
  else if (diff < 0) credit("clearing", -diff);

  // COGS / inventory (own balanced pair).
  if (r2(cogs) > 0) {
    debit("cogs", cogs);
    credit("inventory", cogs);
  }
  // Refunds: reverse revenue out of cash.
  if (r2(s.refunds) > 0) {
    debit("sales_returns", s.refunds);
    credit("cash", s.refunds);
  }
  return lines;
}
