import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { buildOps } from "./data";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const SEV: Record<string, string> = { high: "text-red-400", medium: "text-amber-400", low: "text-zinc-400" };

export default async function OpsPage() {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_ops", null, {});
  const { disputes, openDisputeCount, incidents, atRisk } = await buildOps(db);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Cross-tenant ops</h1>
        <Link href="/hq" className="text-xs text-zinc-400 hover:text-zinc-200">← HQ</Link>
      </div>

      <Card title={"Disputes" + (openDisputeCount ? " · " + openDisputeCount + " open" : "")}>
        {disputes.length === 0 ? <Empty>No disputes.</Empty> : (
          <table className="w-full text-sm">
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5">{d.businessId ? <Link href={"/hq/merchants/" + d.businessId} className="hover:text-emerald-400">{d.businessName}</Link> : d.businessName}</td>
                  <td className="py-1.5 capitalize text-zinc-400">{d.state.toLowerCase()}{d.reason ? " · " + d.reason.toLowerCase() : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(d.amount)}</td>
                  <td className="py-1.5 text-right">{d.transferId && <a href={"https://dashboard.finix.com/transfers/" + d.transferId} target="_blank" rel="noreferrer" className="text-emerald-400 text-xs hover:underline">Finix →</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={"Open incidents" + (incidents.length ? " · " + incidents.length : "")}>
        {incidents.length === 0 ? <Empty>No open incidents.</Empty> : (
          <table className="w-full text-sm">
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5">{i.businessName}</td>
                  <td className="py-1.5"><span className="capitalize">{i.type}</span> · <span className={"capitalize " + (SEV[i.severity] ?? "")}>{i.severity}</span></td>
                  <td className="py-1.5 text-zinc-400 truncate max-w-xs">{i.body}</td>
                  <td className="py-1.5 text-right text-zinc-500 text-xs">{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={"At-risk merchants" + (atRisk.length ? " · " + atRisk.length : "")}>
        {atRisk.length === 0 ? <Empty>Nothing flagged.</Empty> : (
          <table className="w-full text-sm">
            <tbody>
              {atRisk.map(({ merchant: m, reason }) => (
                <tr key={m.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5"><Link href={"/hq/merchants/" + m.id} className="hover:text-emerald-400">{m.name}</Link> <span className="text-[11px] text-zinc-500 capitalize">{m.status}</span></td>
                  <td className="py-1.5 text-amber-400">{reason}</td>
                  <td className="py-1.5 text-right text-zinc-500 text-xs">{m.lastOrderAt ? "last " + new Date(m.lastOrderAt).toLocaleDateString() : "no orders"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Terminal fleet">
        <p className="text-sm text-zinc-500">Device health/status lives in Finix device monitoring. <a href="https://dashboard.finix.com/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Open Finix Dashboard →</a></p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{children}</p>;
}
