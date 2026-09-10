import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { listMerchants, type MerchantStatus } from "./data";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
const STATUS_STYLE: Record<MerchantStatus, string> = {
  live: "bg-emerald-500/15 text-emerald-400",
  onboarding: "bg-amber-500/15 text-amber-400",
  paused: "bg-red-500/15 text-red-400",
};

export default async function MerchantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; industry?: string; plan?: string; q?: string }>;
}) {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_merchants_list", null, {});
  const sp = await searchParams;
  let rows = await listMerchants(db);

  const q = (sp.q || "").trim().toLowerCase();
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  if (sp.industry) rows = rows.filter((r) => r.industry === sp.industry);
  if (sp.plan) rows = rows.filter((r) => (sp.plan === "none" ? !r.plan : r.plan === sp.plan));
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.orgName.toLowerCase().includes(q));

  const industries = Array.from(new Set(rows.map((r) => r.industry))).sort();
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "—");
  const chip = (label: string, href: string, active: boolean) => (
    <Link href={href} className={"text-xs rounded-full px-2.5 py-1 border " + (active ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}>{label}</Link>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Merchants <span className="text-zinc-500 text-sm font-normal">({rows.length})</span></h1>
        <Link href="/hq" className="text-xs text-zinc-400 hover:text-zinc-200">← HQ</Link>
      </div>

      <form className="mb-3" action="/hq/merchants">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or org…" className="h-9 w-full max-w-sm rounded-md bg-zinc-900 border border-zinc-700 px-3 text-sm" />
      </form>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {chip("All", "/hq/merchants", !sp.status)}
        {(["live", "onboarding", "paused"] as MerchantStatus[]).map((s) => chip(s, "/hq/merchants?status=" + s, sp.status === s))}
        <span className="w-px bg-zinc-800 mx-1" />
        {industries.map((i) => chip(i, "/hq/merchants?industry=" + i, sp.industry === i))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <th className="px-3 py-2 font-medium">Merchant</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Industry</th>
              <th className="px-3 py-2 font-medium">Finix</th>
              <th className="px-3 py-2 font-medium text-right">30d vol</th>
              <th className="px-3 py-2 font-medium">Last order</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60">
                <td className="px-3 py-2">
                  <Link href={"/hq/merchants/" + r.id} className="font-medium hover:text-emerald-400">{r.name}</Link>
                  <div className="text-[12px] text-zinc-500">{r.orgName}{r.locationCount > 1 ? " · " + r.locationCount + " locations" : ""}{r.isDemo ? " · demo" : ""}</div>
                </td>
                <td className="px-3 py-2"><span className={"text-[12px] rounded-full px-2 py-0.5 capitalize " + STATUS_STYLE[r.status]}>{r.status}</span></td>
                <td className="px-3 py-2 text-zinc-300">{r.plan ?? <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2 text-zinc-400 capitalize">{r.industry}</td>
                <td className="px-3 py-2 text-zinc-400">{r.finixState ? r.finixState : <span className="text-zinc-600">none</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.vol30d > 0 ? money(r.vol30d) : <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2 text-zinc-400">{fmtDate(r.lastOrderAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No merchants match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
