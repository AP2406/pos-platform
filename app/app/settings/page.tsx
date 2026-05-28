import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeader } from "../_components/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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