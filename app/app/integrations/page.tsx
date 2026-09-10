import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";
import { integrationStatuses, integrationEnabled, envEssentials } from "@/lib/services/integrations";
import { getCardConfig } from "../pos/finix-pos-actions";
import { IntegrationCard } from "./integration-card";
import { DeliveryTestButton } from "./delivery-test-button";
import { requirePermission } from "@/lib/services/route-access";

const CARD_REASON: Record<string, string> = {
  demo: "Demo business — never processes real money",
  not_configured: "Finix credentials missing",
  training: "Training mode is on",
  not_onboarded: "Finix merchant not onboarded yet",
  not_approved: "Finix merchant pending approval",
};

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { business, role } = await requireBusiness();
  requirePermission(role, "manage_settings");
  if (!hasFloorService(business)) redirect("/app/reports");

  const settings = (business as { settings?: unknown }).settings;
  // Real card-payment readiness (merchant onboarding/approval), surfaced on the Finix card.
  const card = await getCardConfig();
  const cardLive = "enabled" in card && card.enabled === true
    ? "Live — merchant approved"
    : CARD_REASON[(card as { reason?: string }).reason ?? ""] ?? null;

  const statuses = integrationStatuses().map((s) => ({
    ...s,
    enabled: integrationEnabled(settings, s.key),
    liveNote: s.key === "finix_cards" ? cardLive : null,
  }));
  const groups = ["Payments", "Messaging", "Accounting", "Delivery", "Reservations"] as const;
  const env = envEssentials();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect external services. Each is off until you add credentials and enable it — nothing here sends data on its own.
        </p>
      </div>

      {/* GAP-0: environment essentials at a glance */}
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Environment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {env.map((e) => (
            <div key={e.env} className="flex items-center justify-between text-sm">
              <span>{e.label}</span>
              <span className={"text-xs tabular-nums " + (e.ok ? "text-emerald-600" : "text-muted-foreground")}>
                {e.ok ? "configured ✓" : e.env + " missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {groups.map((g) => {
        const items = statuses.filter((s) => s.group === g);
        if (items.length === 0) return null;
        return (
          <div key={g} className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g}</h2>
            <div className="space-y-3">
              {items.map((s) => (
                <div key={s.key}>
                  <IntegrationCard status={s} />
                  {s.key === "delivery" && s.enabled && <DeliveryTestButton />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
