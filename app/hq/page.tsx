import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";

export const dynamic = "force-dynamic";

const PHASES = [
  { key: "HQ-1", title: "Merchant directory", desc: "Every tenant: status, plan, Finix state, last activity.", ready: false },
  { key: "HQ-3", title: "Onboarding funnel", desc: "Apply → KYC → Finix sub-merchant → provision POS tenant.", ready: false },
  { key: "HQ-2", title: "Portfolio economics", desc: "Volume, net revenue, software MRR, rep residual.", ready: false },
  { key: "HQ-4", title: "Reps & residuals", desc: "Commission config, referred merchants, payouts.", ready: false },
  { key: "HQ-5", title: "Cross-tenant ops", desc: "Disputes, incidents, terminal fleet, at-risk merchants.", ready: false },
];

export default async function HqHome() {
  const { admin, db } = await requirePlatformAdmin();
  await auditHq(db, admin, "hq_access", null, { path: "/hq" });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Surge HQ</h1>
      <p className="text-sm text-zinc-400 mt-1">
        Operator control plane across all merchant tenants. Foundation live — phases roll out next.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        {PHASES.map((p) => (
          <div key={p.key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">{p.key}</span>
              <span className="text-[10px] rounded-full bg-zinc-800 text-zinc-400 px-2 py-0.5">Coming soon</span>
            </div>
            <div className="font-medium mt-2">{p.title}</div>
            <div className="text-xs text-zinc-400 mt-1">{p.desc}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-zinc-600 mt-6">
        Raw payments back-office (transactions, disputes, payouts, underwriting) lives in the Finix Dashboard — HQ summarizes and deep-links, never duplicates it.
      </p>
    </div>
  );
}
