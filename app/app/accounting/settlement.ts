import type { createClient } from "@/lib/supabase/server";
import { isFinixConfigured, listSettlements, type FinixSettlement } from "@/lib/services/finix";
import { integrationEnabled } from "@/lib/services/integrations";

// P2.4 processor settlement reconciliation: tie each period's card sales (our
// records) to Finix's settled deposits — gross → fees → net — and flag variance.
// Expected fees use the known Finix schedule; "actual" comes from the settlement
// batches. Read-only; degrades gracefully when not configured/enabled.

// Finix fee schedule (per the merchant agreement). Payout-timing fees vary by
// payout type, so the expected side covers processing fees; payout fees are noted.
export const FINIX_FEES = {
  cardPct: 0.0015, // 0.15%
  perTxn: 0.15, // $0.15
  instantPct: 0.015, // 1.50% instant payout
  t1: 0.75, // T+1 payout
  t2: 0.5, // T+2 payout
  dispute: 30,
  achReturn: 5,
};

const c2d = (cents: number) => Math.round(cents) / 100;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type SettlementReport =
  | { available: false; reason: string }
  | {
      available: true;
      settlements: { id: string; status: string; gross: number; fees: number; net: number; createdAt: string }[];
      settledGross: number;
      settledFees: number;
      settledNet: number;
      cardSales: number; // our recorded card payment volume
      cardTxns: number;
      expectedFees: number; // from the fee schedule
      grossVariance: number; // settledGross − cardSales
      feeVariance: number; // settledFees − expectedFees
    };

export async function settlementReconciliation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  settings: unknown,
  startIso: string,
  endIso: string
): Promise<SettlementReport> {
  if (!integrationEnabled(settings, "settlement")) {
    return { available: false, reason: "Enable “Finix settlement reconciliation” under Integrations." };
  }
  if (!isFinixConfigured()) {
    return { available: false, reason: "Finix isn’t configured in the server environment." };
  }

  // Our recorded card sales for the period (the expected gross).
  const { data: pays } = await supabase
    .from("payments")
    .select("amount, method")
    .eq("business_id", businessId)
    .eq("method", "card")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  const cardSales = r2((pays ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const cardTxns = (pays ?? []).length;
  const expectedFees = r2(cardSales * FINIX_FEES.cardPct + cardTxns * FINIX_FEES.perTxn);

  const res = await listSettlements(startIso, endIso);
  if ("error" in res) {
    return { available: false, reason: "Finix: " + res.error };
  }
  const list: FinixSettlement[] = res.settlements;
  const settledGross = r2(list.reduce((s, x) => s + c2d(x.grossCents), 0));
  const settledFees = r2(list.reduce((s, x) => s + c2d(x.feeCents), 0));
  const settledNet = r2(list.reduce((s, x) => s + c2d(x.netCents), 0));

  return {
    available: true,
    settlements: list.map((x) => ({ id: x.id, status: x.status, gross: c2d(x.grossCents), fees: c2d(x.feeCents), net: c2d(x.netCents), createdAt: x.createdAt })),
    settledGross,
    settledFees,
    settledNet,
    cardSales,
    cardTxns,
    expectedFees,
    grossVariance: r2(settledGross - cardSales),
    feeVariance: r2(settledFees - expectedFees),
  };
}
