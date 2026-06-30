import { createAdminClient } from "@/lib/supabase/admin";
import { listSettlementsForMerchant } from "@/lib/services/finix";
import { merchantMrr, netProcessing, finixCost, type RateSource } from "@/lib/services/hq/economics";

type AdminDb = ReturnType<typeof createAdminClient>;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type PortfolioRow = {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  volume: number;
  txns: number;
  effPct: number;
  rateSource: RateSource;
  grossTake: number;
  finixCost: number;
  netProcessing: number;
  mrr: number;
  residual: number;
  repId: string | null;
  repName: string | null;
  finixMerchantId: string | null;
};

export type Portfolio = {
  rows: PortfolioRow[];
  totals: { volume: number; netProcessing: number; mrr: number; residual: number; activeMerchants: number; churned: number; merchants: number };
  anyDerived: boolean;
};

// Derive a merchant's real effective rate from its Finix settlements (fees ÷ gross)
// when batches exist; null → the roll-up falls back to the blended constant.
async function derivedRate(merchantId: string | null, sinceIso: string, untilIso: string): Promise<number | null> {
  if (!merchantId) return null;
  try {
    const res = await listSettlementsForMerchant(merchantId, sinceIso, untilIso);
    if ("error" in res || res.settlements.length === 0) return null;
    let gross = 0, fee = 0;
    for (const s of res.settlements) { gross += s.grossCents; fee += s.feeCents; }
    return gross > 0 ? fee / gross : null;
  } catch {
    return null;
  }
}

export async function buildPortfolio(db: AdminDb, sinceIso: string, untilIso: string): Promise<Portfolio> {
  const [{ data: biz }, { data: pays }, { data: repRows }] = await Promise.all([
    db.from("businesses").select("id, name, plan, custom_mrr, rep_id, finix_merchant_id, finix_merchant_state, access_status, is_demo"),
    db.from("finix_payments").select("business_id, amount_cents, status, created_at").eq("status", "succeeded").gte("created_at", sinceIso).lt("created_at", untilIso),
    db.from("reps").select("id, name, residual_pct"),
  ]);
  const repById = new Map((repRows ?? []).map((r) => [r.id as string, { name: (r.name as string) || "—", pct: Number(r.residual_pct) || 0 }]));

  // Volume + txns per business (cents -> dollars immediately).
  const vol = new Map<string, number>();
  const txn = new Map<string, number>();
  for (const p of pays ?? []) {
    const id = p.business_id as string;
    vol.set(id, (vol.get(id) ?? 0) + (Number(p.amount_cents) || 0) / 100);
    txn.set(id, (txn.get(id) ?? 0) + 1);
  }

  // Derive per-merchant rates in parallel (empty in sandbox -> all blended fallback).
  const merchants = (biz ?? []).filter((b) => (b.finix_merchant_id as string | null));
  const derived = new Map<string, number | null>();
  await Promise.all(merchants.map(async (b) => {
    derived.set(b.id as string, await derivedRate(b.finix_merchant_id as string, sinceIso, untilIso));
  }));

  const rows: PortfolioRow[] = (biz ?? [])
    .filter((b) => (b.is_demo as boolean) !== true)
    .map((b) => {
      const id = b.id as string;
      const volume = r2(vol.get(id) ?? 0);
      const txns = txn.get(id) ?? 0;
      const np = netProcessing(volume, txns, derived.get(id) ?? null);
      const status = (b.access_status === "suspended" || b.access_status === "past_due") ? "paused"
        : ((b.finix_merchant_state as string | null) || "").toUpperCase() === "APPROVED" ? "live" : "onboarding";
      const rep = (b.rep_id as string | null) ? repById.get(b.rep_id as string) : undefined;
      return {
        id,
        name: (b.name as string) || "—",
        plan: (b.plan as string | null) ?? null,
        status,
        volume,
        txns,
        effPct: np.effPct,
        rateSource: np.source,
        grossTake: np.gross,
        finixCost: finixCost(volume, txns),
        netProcessing: np.net,
        mrr: merchantMrr((b.plan as string | null) ?? null, (b.custom_mrr as number | null) ?? null),
        residual: rep ? r2(np.net * rep.pct) : 0,
        repId: (b.rep_id as string | null) ?? null,
        repName: rep?.name ?? null,
        finixMerchantId: (b.finix_merchant_id as string | null) ?? null,
      };
    })
    .sort((a, b) => b.netProcessing + b.mrr - (a.netProcessing + a.mrr));

  const totals = {
    volume: r2(rows.reduce((s, r) => s + r.volume, 0)),
    netProcessing: r2(rows.reduce((s, r) => s + r.netProcessing, 0)),
    mrr: r2(rows.reduce((s, r) => s + r.mrr, 0)),
    residual: r2(rows.reduce((s, r) => s + r.residual, 0)),
    activeMerchants: rows.filter((r) => r.volume > 0).length,
    churned: rows.filter((r) => r.status === "live" && r.volume === 0).length,
    merchants: rows.length,
  };

  return { rows, totals, anyDerived: rows.some((r) => r.rateSource === "derived") };
}
