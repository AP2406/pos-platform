import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { buildPortfolio } from "./data";
import { BLENDED_TAKE_RATE } from "@/lib/services/hq/economics";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const pct = (f: number) => (f * 100).toFixed(2) + "%";

const RANGES: Record<string, { label: string; days: number }> = {
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  mtd: { label: "Month to date", days: 0 },
};

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_portfolio", null, {});
  const sp = await searchParams;
  const rangeKey = sp.range && RANGES[sp.range] ? sp.range : "30d";

  const now = new Date();
  const until = new Date(now.getTime() + 86400000).toISOString(); // include today
  const since = rangeKey === "mtd"
    ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    : new Date(now.getTime() - RANGES[rangeKey].days * 86400000).toISOString();

  const { rows, totals, anyDerived } = await buildPortfolio(db, since, until);

  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Portfolio economics</h1>
        <Link href="/hq" className="text-xs text-zinc-400 hover:text-zinc-200">← HQ</Link>
      </div>

      <div className="flex gap-1.5 mb-4">
        {Object.entries(RANGES).map(([k, v]) => (
          <Link key={k} href={"/hq/portfolio?range=" + k} className={"text-xs rounded-full px-3 py-1 border " + (rangeKey === k ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}>{v.label}</Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {tile("Processing volume", money(totals.volume), totals.activeMerchants + " active · " + totals.merchants + " merchants")}
        {tile("Net processing revenue", money(totals.netProcessing))}
        {tile("Software MRR", money(totals.mrr))}
        {tile("Rep residual", money(totals.residual), "owed to reps")}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <th className="px-3 py-2 font-medium">Merchant</th>
              <th className="px-3 py-2 font-medium text-right">Volume</th>
              <th className="px-3 py-2 font-medium text-right">Txns</th>
              <th className="px-3 py-2 font-medium text-right">Eff. rate</th>
              <th className="px-3 py-2 font-medium text-right">Net proc.</th>
              <th className="px-3 py-2 font-medium text-right">MRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60">
                <td className="px-3 py-2"><Link href={"/hq/merchants/" + r.id} className="font-medium hover:text-emerald-400">{r.name}</Link><div className="text-[11px] text-zinc-500 capitalize">{r.status}{r.plan ? " · " + r.plan : ""}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.volume > 0 ? money(r.volume) : <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.txns || ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.volume > 0 ? (
                    <>
                      {pct(r.effPct)}
                      <span className={"ml-1 text-[10px] " + (r.rateSource === "derived" ? "text-emerald-500" : "text-zinc-500")}>{r.rateSource === "derived" ? "derived" : "blended"}</span>
                    </>
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.netProcessing !== 0 ? money(r.netProcessing) : <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.mrr > 0 ? money(r.mrr) : <span className="text-zinc-600">—</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">No merchants.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-zinc-600 mt-4">
        Volume from recorded card transactions ({"finix_payments"}). Effective rate is <span className="text-emerald-600">derived</span> from each merchant&apos;s Finix settlements when available, else the blended fallback ({pct(BLENDED_TAKE_RATE.pct)} + {money(BLENDED_TAKE_RATE.perTxn)}/txn).
        {!anyDerived && " No settled batches yet — all rows use the blended fallback."} Rep residual lands with HQ-4. Edit pricing in lib/services/hq/economics.ts.
      </p>
    </div>
  );
}
