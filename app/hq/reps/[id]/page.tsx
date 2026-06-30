import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { getRep } from "../data";
import { PayoutForm } from "../rep-forms-client";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

export default async function RepDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, db } = await requirePlatformAdmin();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const until = new Date(now.getTime() + 86400000).toISOString();
  const detail = await getRep(db, id, since, until);
  if (!detail) notFound();
  await auditHq(db, admin, "hq_rep_view", null, { rep_id: id });

  const { rep, merchants, payouts } = detail;
  const canWrite = admin.role === "owner" || admin.role === "ops";

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">{rep.name}</h1>
        <Link href="/hq/reps" className="text-xs text-zinc-400 hover:text-zinc-200">← Reps</Link>
      </div>
      <p className="text-sm text-zinc-500 mb-5">
        <span className="font-mono">{rep.code}</span> · {(rep.residualPct * 100).toFixed(0)}% residual · {money(rep.bounty)} bounty · {rep.clawbackMonths}mo clawback · <span className="capitalize">{rep.status}</span>
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Residual (30d)" value={money(rep.residual)} />
        <Stat label="Bounty accrued" value={money(rep.bountyAccrued)} />
        <Stat label="Merchants" value={rep.merchantCount + " (" + rep.liveCount + " live)"} />
      </div>

      <Card title="Referred merchants">
        {merchants.length === 0 ? <p className="text-sm text-zinc-500">No merchants attributed yet.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {merchants.map((m) => (
                <tr key={m.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5"><Link href={"/hq/merchants/" + m.id} className="hover:text-emerald-400">{m.name}</Link> <span className="text-[11px] text-zinc-500 capitalize">{m.status}</span></td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-400">{m.volume > 0 ? money(m.volume) + " vol" : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.residual > 0 ? money(m.residual) + " residual" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Payouts">
        {canWrite && <div className="mb-3"><PayoutForm repId={rep.id} /></div>}
        {payouts.length === 0 ? <p className="text-sm text-zinc-500">No payouts recorded.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5 text-zinc-400">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="py-1.5 text-zinc-400">{p.period ?? ""}{p.note ? " · " + p.note : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div><div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>{children}</div>;
}
