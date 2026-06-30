import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { getMerchant } from "../data";
import { MerchantActions } from "../merchant-actions-client";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

export default async function MerchantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, db } = await requirePlatformAdmin();
  const detail = await getMerchant(db, id);
  if (!detail) notFound();
  await auditHq(db, admin, "hq_merchant_view", id, {});

  const m = detail.merchant;
  const canWrite = admin.role === "owner" || admin.role === "ops";
  const finixUrl = m.finixMerchantId ? "https://dashboard.finix.com/merchants/" + m.finixMerchantId : null;
  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

  return (
    <div className="max-w-4xl">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">{m.name}</h1>
        <Link href="/hq/merchants" className="text-xs text-zinc-400 hover:text-zinc-200">← Merchants</Link>
      </div>
      <p className="text-sm text-zinc-500 mb-5">
        {m.orgName} · <span className="capitalize">{m.industry}</span> · <span className="capitalize">{m.status}</span>
        {m.plan ? " · " + m.plan : ""}{m.isDemo ? " · demo" : ""}
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Stat label="30-day volume" value={money(m.vol30d)} />
        <Stat label="Last order" value={m.lastOrderAt ? new Date(m.lastOrderAt).toLocaleDateString() : "—"} />
        <Stat label="Created" value={m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"} />
      </div>

      <Card title="Payments (Finix)">
        {m.finixMerchantId ? (
          <div className="text-sm space-y-1">
            <div>State: <span className="capitalize">{m.finixState || "—"}</span></div>
            <div className="font-mono text-xs text-zinc-400">{m.finixMerchantId}</div>
            <a href={finixUrl!} target="_blank" rel="noreferrer" className="text-emerald-400 text-sm hover:underline">Open in Finix Dashboard →</a>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No Finix merchant linked yet (onboarding).</p>
        )}
      </Card>

      <Card title="Team">
        {detail.members.length === 0 ? (
          <p className="text-sm text-zinc-500">No business members.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {detail.members.map((u) => (
                <tr key={u.userId} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5">{u.email || <span className="text-zinc-500 font-mono text-xs">{u.userId}</span>}</td>
                  <td className="py-1.5 text-right text-zinc-400 capitalize">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recent orders">
        {detail.recentOrders.length === 0 ? (
          <p className="text-sm text-zinc-500">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {detail.recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-zinc-800 last:border-0">
                  <td className="py-1.5 text-zinc-400">{fmt(o.createdAt)}</td>
                  <td className="py-1.5 capitalize text-zinc-400">{o.status}{o.channel ? " · " + o.channel : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Operator actions">
        <MerchantActions businessId={m.id} paused={m.status === "paused"} plan={m.plan} customMrr={m.customMrr} repId={m.repId} reps={detail.reps} canWrite={canWrite} />
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">{title}</h2>
      {children}
    </div>
  );
}
