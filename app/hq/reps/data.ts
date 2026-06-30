import { createAdminClient } from "@/lib/supabase/admin";
import { buildPortfolio, type PortfolioRow } from "../portfolio/data";

type AdminDb = ReturnType<typeof createAdminClient>;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type Rep = {
  id: string;
  name: string;
  email: string | null;
  code: string;
  status: string;
  residualPct: number;
  bounty: number;
  clawbackMonths: number;
};

export type RepSummary = Rep & { merchantCount: number; liveCount: number; residual: number; volume: number; bountyAccrued: number };

function mapRep(r: Record<string, unknown>): Rep {
  return {
    id: r.id as string,
    name: (r.name as string) || "—",
    email: (r.email as string | null) ?? null,
    code: (r.code as string) || "",
    status: (r.status as string) || "active",
    residualPct: Number(r.residual_pct) || 0,
    bounty: Number(r.bounty) || 0,
    clawbackMonths: Number(r.clawback_months) || 0,
  };
}

function summarize(rep: Rep, rows: PortfolioRow[]): RepSummary {
  const live = rows.filter((m) => m.status === "live").length;
  return {
    ...rep,
    merchantCount: rows.length,
    liveCount: live,
    residual: r2(rows.reduce((s, m) => s + m.residual, 0)),
    volume: r2(rows.reduce((s, m) => s + m.volume, 0)),
    bountyAccrued: r2(live * rep.bounty),
  };
}

export async function listReps(db: AdminDb, sinceIso: string, untilIso: string): Promise<RepSummary[]> {
  const [{ data: reps }, portfolio] = await Promise.all([
    db.from("reps").select("*").order("created_at", { ascending: false }),
    buildPortfolio(db, sinceIso, untilIso),
  ]);
  const byRep = new Map<string, PortfolioRow[]>();
  for (const m of portfolio.rows) if (m.repId) (byRep.get(m.repId) ?? byRep.set(m.repId, []).get(m.repId)!).push(m);
  return (reps ?? []).map((r) => summarize(mapRep(r as Record<string, unknown>), byRep.get((r as { id: string }).id) ?? []));
}

export type RepDetail = {
  rep: RepSummary;
  merchants: PortfolioRow[];
  payouts: { id: string; amount: number; period: string | null; note: string | null; createdAt: string }[];
};

export async function getRep(db: AdminDb, id: string, sinceIso: string, untilIso: string): Promise<RepDetail | null> {
  const { data: repRow } = await db.from("reps").select("*").eq("id", id).maybeSingle();
  if (!repRow) return null;
  const rep = mapRep(repRow as Record<string, unknown>);

  const portfolio = await buildPortfolio(db, sinceIso, untilIso);
  const merchants = portfolio.rows.filter((m) => m.repId === id);

  const { data: payRows } = await db.from("rep_payouts").select("id, amount, period, note, created_at").eq("rep_id", id).order("created_at", { ascending: false });
  const payouts = (payRows ?? []).map((p) => ({
    id: p.id as string, amount: Number(p.amount) || 0, period: (p.period as string | null) ?? null,
    note: (p.note as string | null) ?? null, createdAt: (p.created_at as string) ?? "",
  }));

  return { rep: summarize(rep, merchants), merchants, payouts };
}
