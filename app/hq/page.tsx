import Link from "next/link";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/hq/merchants", title: "Merchants", desc: "Every tenant: status, plan, Finix state, last activity." },
  { href: "/hq/portfolio", title: "Portfolio economics", desc: "Volume, net revenue, software MRR, rep residual." },
  { href: "/hq/onboarding", title: "Onboarding funnel", desc: "Apply → KYC → Finix sub-merchant → provision POS tenant." },
  { href: "/hq/reps", title: "Reps & residuals", desc: "Commission config, referred merchants, payouts." },
  { href: "/hq/ops", title: "Cross-tenant ops", desc: "Disputes, incidents, at-risk merchants, terminal fleet." },
];

export default async function HqHome() {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_access", null, { path: "/hq" });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Surge HQ</h1>
      <p className="text-sm text-zinc-400 mt-1">
        Operator control plane across all merchant tenants.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        {SECTIONS.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 hover:bg-zinc-900/60 transition-colors">
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{p.desc}</div>
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-zinc-600 mt-6">
        Raw payments back-office (transactions, disputes, payouts, underwriting) lives in the Finix Dashboard — HQ summarizes and deep-links, never duplicates it.
      </p>
    </div>
  );
}
