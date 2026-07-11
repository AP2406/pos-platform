import type { AccountingSummary } from "./data";

// Double-entry Daily Sales Journal Entry (DSJE) for QBO/Xero import. We post one
// balanced summary entry for the period: tenders (debits) against revenue, tax,
// tips and service charge (credits); a clearing line absorbs any rounding/tip
// mismatch; COGS and refunds post as their own balanced pairs. Account codes come
// from the business's chart-of-accounts mapping (settings.coa), else our defaults.

export type CoaKey =
  | "sales" | "service_charge" | "tax_payable" | "tips_payable"
  | "cash" | "card" | "gift_card" | "store_credit" | "house_account" | "other"
  | "cogs" | "inventory" | "sales_returns" | "clearing"
  // F10: comp/discount/promo contra-revenue accounts, by reason.
  | "comp_manager" | "comp_meal" | "discount_loyalty" | "discount_promo";

export const COA_DEFAULTS: Record<CoaKey, { name: string; code: string }> = {
  sales: { name: "Food & beverage sales", code: "4000" },
  service_charge: { name: "Service charge income", code: "4100" },
  tax_payable: { name: "GST/HST payable", code: "2200" },
  tips_payable: { name: "Tips payable", code: "2300" },
  cash: { name: "Cash", code: "1000" },
  card: { name: "Card clearing", code: "1010" },
  gift_card: { name: "Gift card liability", code: "2400" },
  store_credit: { name: "Store credit liability", code: "2410" },
  house_account: { name: "House accounts receivable", code: "1210" },
  other: { name: "Other tender clearing", code: "1020" },
  cogs: { name: "Cost of goods sold", code: "5000" },
  inventory: { name: "Inventory", code: "1200" },
  sales_returns: { name: "Sales returns & refunds", code: "4900" },
  clearing: { name: "Over/short clearing", code: "9999" },
  comp_manager: { name: "Comps — manager", code: "4700" },
  comp_meal: { name: "Comps — employee meals", code: "4710" },
  discount_loyalty: { name: "Discounts — loyalty", code: "4720" },
  discount_promo: { name: "Discounts — promo", code: "4730" },
};

// F10: map a comp/discount audit reason code to its contra-revenue account.
export function compDiscountAccount(action: "comp" | "discount", reasonCode: string | null): CoaKey {
  const r = (reasonCode || "").toLowerCase();
  if (action === "comp") return /meal|staff|employee|shift/.test(r) ? "comp_meal" : "comp_manager";
  return /loyal|reward|point|member/.test(r) ? "discount_loyalty" : "discount_promo";
}

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
  cash: "cash", card: "card", gift_card: "gift_card", store_credit: "store_credit",
  house_account: "house_account", other: "other",
};

export function buildJournal(
  s: AccountingSummary,
  cogs: number,
  coa: Coa,
  memo: string,
  contra?: { key: CoaKey; amount: number }[]
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
  // F10: comps/discounts post to their own contra-revenue accounts (debits),
  // grossing sales up — instead of disappearing into the clearing line.
  let contraTotal = 0;
  for (const c of contra ?? []) { debit(c.key, c.amount); contraTotal += r2(c.amount); totalDebit += r2(c.amount); }

  // Revenue / liabilities (credits). Sales is grossed up by the contra total.
  let totalCredit = 0;
  const addCredit = (k: CoaKey, amt: number) => { credit(k, amt); totalCredit += amt; };
  addCredit("sales", r2(s.netSales + contraTotal));
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
  // Refunds: reverse revenue. The portion refunded against a house account reduces
  // AR (no cash left the drawer); the rest comes out of cash.
  if (r2(s.refunds) > 0) {
    debit("sales_returns", s.refunds);
    const haRefunds = r2(s.houseAccountRefunds ?? 0);
    if (haRefunds > 0) credit("house_account", haRefunds);
    const cashRefunds = r2(s.refunds - haRefunds);
    if (cashRefunds > 0) credit("cash", cashRefunds);
  }
  // House-account settlements: the customer paid down their tab. Debit the tender
  // received, credit AR (balanced pair, doesn't touch revenue).
  for (const st of s.houseAccountSettlements ?? []) {
    const amt = r2(st.amount);
    if (amt <= 0) continue;
    debit(TENDER_KEY[st.method] ?? "other", amt);
    credit("house_account", amt);
  }
  return lines;
}
