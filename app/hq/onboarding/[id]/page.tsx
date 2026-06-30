import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin, auditHq } from "@/lib/services/platform";
import { getApplication } from "../data";
import { StatusControl } from "../status-control";
import { ProvisionForm } from "../provision-form";

export const dynamic = "force-dynamic";

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, db } = await requirePlatformAdmin();
  const app = await getApplication(db, id);
  if (!app) notFound();
  await auditHq(db, admin, "hq_application_view", null, { application_id: id });

  const canWrite = admin.role === "owner" || admin.role === "ops";
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-zinc-800 last:border-0">
      <span className="text-zinc-500 text-sm">{k}</span><span className="text-sm text-right">{v ?? "—"}</span>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold">{app.businessName}</h1>
        <Link href="/hq/onboarding" className="text-xs text-zinc-400 hover:text-zinc-200">← Onboarding</Link>
      </div>
      <p className="text-sm text-zinc-500 mb-5 capitalize">{app.status}{app.industry ? " · " + app.industry : ""}{app.plan ? " · " + app.plan : ""}</p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4">
        {row("Contact", app.contactName)}
        {row("Email", app.contactEmail)}
        {row("Phone", app.contactPhone)}
        {row("Industry", <span className="capitalize">{app.industry ?? "—"}</span>)}
        {row("Plan", app.plan)}
        {row("Referred by rep", app.referredByRep)}
        {row("Applied", app.createdAt ? new Date(app.createdAt).toLocaleString() : "—")}
        {app.provisionedBusinessId && row("Provisioned tenant", <Link href={"/hq/merchants/" + app.provisionedBusinessId} className="text-emerald-400 hover:underline">open →</Link>)}
        {app.finixMerchantId && row("Finix merchant", <span className="font-mono text-xs">{app.finixMerchantId}</span>)}
        {app.notes && row("Notes", app.notes)}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Pipeline</h2>
        <StatusControl id={app.id} status={app.status} canWrite={canWrite} />
      </div>

      {canWrite && (app.status === "approved" || app.status === "provisioned") && !app.provisionedBusinessId && (
        <div className="rounded-xl border border-emerald-900/60 bg-zinc-900 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-2">Approve &amp; provision</h2>
          <ProvisionForm
            applicationId={app.id}
            defaultBusinessName={app.businessName}
            defaultOwnerFirst={(app.contactName ?? "").split(/\s+/)[0] ?? ""}
            defaultOwnerLast={(app.contactName ?? "").split(/\s+/).slice(1).join(" ")}
          />
        </div>
      )}
    </div>
  );
}
