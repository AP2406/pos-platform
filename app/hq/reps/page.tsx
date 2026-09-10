import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { listReps } from "./data";
import { AddRepForm } from "./rep-forms-client";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

export default async function RepsPage() {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_reps_list", null, {});
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const until = new Date(now.getTime() + 86400000).toISOString();
  const reps = await listReps(db, since, until);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Reps <span className="text-zinc-500 text-sm font-normal">({reps.length})</span></h1>
        <Link href="/hq" className="text-xs text-zinc-400 hover:text-zinc-200">← HQ</Link>
      </div>

      <AddRepForm />

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <th className="px-3 py-2 font-medium">Rep</th>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium text-right">Residual %</th>
              <th className="px-3 py-2 font-medium text-right">Merchants</th>
              <th className="px-3 py-2 font-medium text-right">Residual (30d)</th>
              <th className="px-3 py-2 font-medium text-right">Bounty accrued</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60">
                <td className="px-3 py-2"><Link href={"/hq/reps/" + r.id} className="font-medium hover:text-emerald-400">{r.name}</Link><div className="text-[12px] text-zinc-500 capitalize">{r.status}{r.email ? " · " + r.email : ""}</div></td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.code}</td>
                <td className="px-3 py-2 text-right tabular-nums">{(r.residualPct * 100).toFixed(0)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.merchantCount} <span className="text-zinc-600">({r.liveCount} live)</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.residual > 0 ? money(r.residual) : <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.bountyAccrued > 0 ? money(r.bountyAccrued) : <span className="text-zinc-600">—</span>}</td>
              </tr>
            ))}
            {reps.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">No reps yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-zinc-600 mt-3">Residual = each merchant&apos;s net processing revenue (30d) × the rep&apos;s residual %. Bounty accrues per live referred merchant; clawback within the window is flagged on the rep page.</p>
    </div>
  );
}
