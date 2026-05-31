import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeader } from "../_components/ui";
import { SettingsForm } from "./settings-form";
import { LeadInboxCard } from "./lead-inbox-card";
import { DriversSettingCard } from "./drivers-setting-card";
import { NotificationsCard } from "./notifications-card";

export default async function SettingsPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let squareIntegration = null;
  if (role === "owner") {
    const { data } = await supabase
      .from("business_integrations")
      .select("id, is_active, environment, connected_at")
      .eq("business_id", business.id)
      .eq("provider", "square")
      .maybeSingle();
    squareIntegration = data;
  }

  const squareConnected =
    squareIntegration != null && squareIntegration.is_active;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and account."
      />

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Business profile</SectionHeader>
        <SettingsForm
          initialName={business.name}
          initialTimezone={business.timezone || "America/Toronto"}
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <SectionHeader>Details</SectionHeader>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Industry</dt>
            <dd className="font-medium capitalize">
              {business.industry.replace("_", " ")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Your role</dt>
            <dd className="font-medium capitalize">{role}</dd>
          </div>
        </dl>
      </div>

      {role === "owner" ? (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>Integrations</SectionHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Square invoices</p>
              <p className="text-muted-foreground text-sm">
                Auto-create draft invoices in your Square account when a trip is
                booked.
              </p>
            </div>
            {squareConnected ? (
              <span className="text-sm font-medium text-green-600">
                Connected
              </span>
            ) : (
              <form action="/api/integrations/square/connect" method="get">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 whitespace-nowrap"
                >
                  Connect with Square
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {business.industry === "transportation" && role === "owner" && (
        <div className="bg-card border border-border rounded-lg p-6 mb-4">
          <SectionHeader>Features</SectionHeader>
          <DriversSettingCard
            initialEnabled={business.drivers_enabled !== false}
          />
        </div>
      )}

      <div className="mb-4">
        <NotificationsCard />
      </div>

      <LeadInboxCard />

      <div className="bg-card border border-border rounded-lg p-6">
        <SectionHeader>Account</SectionHeader>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}