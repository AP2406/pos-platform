import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { listApplications } from "./data";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-400",
  kyc: "bg-amber-500/15 text-amber-400",
  submitted: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  provisioned: "bg-emerald-500/15 text-emerald-400",
  live: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_onboarding_list", null, {});
  const sp = await searchParams;
  let rows = await listApplications(db);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);

  const counts = new Map<string, number>();
  for (const r of await listApplications(db)) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const statuses = ["new", "kyc", "submitted", "approved", "provisioned", "live", "rejected"];
  const chip = (label: string, href: string, active: boolean) => (
    <Link href={href} className={"text-xs rounded-full px-2.5 py-1 border " + (active ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}>{label}</Link>
  );

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Onboarding <span className="text-zinc-500 text-sm font-normal">({rows.length})</span></h1>
        <Link href="/hq" className="text-xs text-zinc-400 hover:text-zinc-200">← HQ</Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {chip("All", "/hq/onboarding", !sp.status)}
        {statuses.map((s) => chip(s + " (" + (counts.get(s) ?? 0) + ")", "/hq/onboarding?status=" + s, sp.status === s))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Industry</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Rep</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900/60">
                <td className="px-3 py-2"><Link href={"/hq/onboarding/" + r.id} className="font-medium hover:text-emerald-400">{r.businessName}</Link></td>
                <td className="px-3 py-2 text-zinc-400">{r.contactEmail}</td>
                <td className="px-3 py-2 text-zinc-400 capitalize">{r.industry ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{r.plan ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{r.referredByRep ?? <span className="text-zinc-600">—</span>}</td>
                <td className="px-3 py-2"><span className={"text-[11px] rounded-full px-2 py-0.5 capitalize " + (STATUS_STYLE[r.status] ?? "bg-zinc-800 text-zinc-400")}>{r.status}</span></td>
                <td className="px-3 py-2 text-zinc-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No applications.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
