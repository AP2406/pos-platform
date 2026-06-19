import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { integrationStatuses, integrationEnabled } from "@/lib/services/integrations";
import { IntegrationCard } from "./integration-card";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const settings = (business as { settings?: unknown }).settings;
  const statuses = integrationStatuses().map((s) => ({ ...s, enabled: integrationEnabled(settings, s.key) }));
  const groups = ["Payments", "Accounting", "Delivery", "Reservations"] as const;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect external services. Each is off until you add credentials and enable it — nothing here sends data on its own.
        </p>
      </div>

      {groups.map((g) => {
        const items = statuses.filter((s) => s.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g}</h2>
            <div className="space-y-3">
              {items.map((s) => <IntegrationCard key={s.key} status={s} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
