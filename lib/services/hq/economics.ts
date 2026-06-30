// Operator-set economics for the Surge HQ portfolio roll-up. EDIT HERE — these are
// business inputs, intentionally isolated from the roll-up logic so changing pricing
// never means touching queries. Money is numeric dollars throughout.

// 1) Plan -> monthly software MRR (dollars). Keys MUST match the stored plan label
//    (see app/apply PLANS). A per-merchant custom_mrr override wins when set.
export const PLAN_MRR: Record<string, number> = {
  "Starter $49": 49, // operator-set — edit here
  "Pro $99": 99, // operator-set — edit here
};

// 2) Blended merchant take-rate — FALLBACK ONLY, used when a merchant has no
//    processing history to derive a real effective rate from. Matches Surge's
//    published in-person rate.
export const BLENDED_TAKE_RATE = { pct: 0.025, perTxn: 0.15 }; // 2.5% + $0.15 — operator-set

// 3) Finix's processing cost to the platform (mirrors accounting/settlement.ts).
export const FINIX_COST = { pct: 0.0015, perTxn: 0.15 }; // 0.15% + $0.15 — operator-set

// ---- pure helpers (dollars in, dollars out) ----
export type RateSource = "derived" | "blended_fallback";
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// MRR for a merchant: a custom override wins (hand-priced tenants like Pearson),
// else the plan tier price, else 0.
export function merchantMrr(plan: string | null, customMrr: number | null): number {
  if (customMrr != null) return r2(customMrr);
  return plan && PLAN_MRR[plan] != null ? PLAN_MRR[plan] : 0;
}

// Gross amount Surge bills the merchant on `volume`/`txns`. When a real effective
// rate is derived from Finix settlement data (captures card mix), use it; otherwise
// fall back to the blended constant.
export function grossTake(volume: number, txns: number, derivedPct: number | null): { gross: number; source: RateSource; effPct: number } {
  if (derivedPct != null && volume > 0) {
    return { gross: r2(volume * derivedPct), source: "derived", effPct: derivedPct };
  }
  const gross = r2(volume * BLENDED_TAKE_RATE.pct + txns * BLENDED_TAKE_RATE.perTxn);
  return { gross, source: "blended_fallback", effPct: volume > 0 ? gross / volume : BLENDED_TAKE_RATE.pct };
}

export function finixCost(volume: number, txns: number): number {
  return r2(volume * FINIX_COST.pct + txns * FINIX_COST.perTxn);
}

// Net processing revenue to Surge = what we bill the merchant − Finix's cost.
export function netProcessing(volume: number, txns: number, derivedPct: number | null): { net: number; gross: number; source: RateSource; effPct: number } {
  const t = grossTake(volume, txns, derivedPct);
  return { net: r2(t.gross - finixCost(volume, txns)), gross: t.gross, source: t.source, effPct: t.effPct };
}
