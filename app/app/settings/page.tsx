import type { ReactNode } from "react";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeader } from "../_components/ui";
import { SettingsForm } from "./settings-form";
import { TaxCurrencyForm } from "./tax-currency-form";
import { TaxRatesCard } from "./tax-rates-card";
import { TrainingModeForm } from "./training-mode-form";
import { ShowPhotosForm } from "./show-photos-form";
import { StaffCard } from "./staff-card";
import { FloorCard } from "./floor-card";
import { hasFloorService } from "@/lib/modules/modes";
import { listFloor, listFloorPlans } from "../floor/floor-actions";
import { LeadInboxCard } from "./lead-inbox-card";
import { DriversSettingCard } from "./drivers-setting-card";
import { NotificationsCard } from "./notifications-card";
import { GoogleAdsCard } from "./google-ads-card";
import { SettingsTabs } from "./settings-tabs";
import { ReceiptSettingsForm } from "./receipt-settings-form";
import type { ReceiptSettings } from "../pos/receipt-template";
import { PrinterSettings } from "../pos/printer-setup";

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

  const rawTax = Number(business.default_tax_rate) || 0;
  const taxPercent = Math.round((rawTax > 1 ? rawTax : rawTax * 100) * 100) / 100;

  const { data: taxRatesData } = await supabase
    .from("tax_rates")
    .select("id, name, rate")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const taxRates = (taxRatesData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    rate: Number(r.rate),
  }));

  const trainingMode =
    (business as { training_mode?: boolean }).training_mode === true;

  const showItemPhotos =
    (business as { show_item_photos?: boolean }).show_item_photos !== false;

  let staffList: { id: string; name: string; role: string; is_active: boolean; has_pin: boolean }[] = [];
  if (role === "owner" || role === "manager") {
    const { data: staffData } = await supabase
      .from("staff_members")
      .select("id, name, role, is_active, pin_hash")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });
    staffList = (staffData ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      role: s.role as string,
      is_active: s.is_active as boolean,
      has_pin: !!s.pin_hash,
    }));
  }

  const showFloor =
    hasFloorService(business) && (role === "owner" || role === "manager");
  let floorPlans: Awaited<ReturnType<typeof listFloorPlans>> = [];
  let floorElements: Awaited<ReturnType<typeof listFloor>>["elements"] = [];
  const chairMode: "follow" | "editable" =
    (business as { floor_chair_mode?: string }).floor_chair_mode === "editable" ? "editable" : "follow";
  if (showFloor) {
    floorPlans = await listFloorPlans();
    if (floorPlans[0]) floorElements = (await listFloor(floorPlans[0].id)).elements;
  }

  let receiptSettings: Partial<ReceiptSettings> | null = null;
  if (role === "owner") {
    const { data: rsRow } = await supabase
      .from("businesses")
      .select("receipt_settings")
      .eq("id", business.id)
      .maybeSingle();
    receiptSettings =
      (rsRow?.receipt_settings as Partial<ReceiptSettings> | null) ?? null;
  }

  const notifPrefs: Record<string, boolean> = {};
  if (user) {
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("type, enabled")
      .eq("user_id", user.id);
    for (const r of (prefRows ?? []) as { type: string; enabled: boolean }[]) {
      notifPrefs[r.type] = r.enabled;
    }
  }

  const sections: { key: string; label: string; content: ReactNode }[] = [];

  sections.push({
    key: "general",
    label: "General",
    content: (
      <>
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
              <dd className="font-medium">{user?.email ?? "\u2014"}</dd>
            </div>
          </dl>
        </div>
      </>
    ),
  });

  if (role === "owner") {
    sections.push({
      key: "tax",
      label: "Tax",
      content: (
        <>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <SectionHeader>Tax and currency</SectionHeader>
            <TaxCurrencyForm
              initialTaxPercent={taxPercent}
              initialCurrency={business.currency || "CAD"}
            />
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <SectionHeader>Additional tax rates</SectionHeader>
            <TaxRatesCard initialRates={taxRates} />
          </div>
        </>
      ),
    });
  }

  if (role === "owner") {
    sections.push({
      key: "receipts",
      label: "Receipts",
      content: (
        <div className="bg-card border border-border rounded-lg p-6">
          <SectionHeader>Receipt design</SectionHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Brand your printed receipts. Changes apply to every register for this business.
          </p>
          <ReceiptSettingsForm initial={receiptSettings} businessName={business.name} />
        </div>
      ),
    });
  }

  sections.push({
    key: "printer",
    label: "Printer",
    content: (
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionHeader>Receipt printer</SectionHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Connect this device to a receipt printer. This setting is saved on this computer and stays connected until you disconnect it.
        </p>
        <PrinterSettings businessName={business.name} />
      </div>
    ),
  });

  if (role === "owner" || role === "manager") {
    sections.push({
      key: "team",
      label: "Team",
      content: (
        <div className="bg-card border border-border rounded-lg p-6">
          <SectionHeader>Staff and PINs</SectionHeader>
          <StaffCard initialStaff={staffList} />
        </div>
      ),
    });
  }

  if (showFloor) {
    sections.push({
      key: "floor",
      label: "Floor",
      content: (
        <div className="bg-card border border-border rounded-lg p-6">
          <SectionHeader>Floor plan</SectionHeader>
          <FloorCard initialPlans={floorPlans} initialElements={floorElements} initialChairMode={chairMode} />
        </div>
      ),
    });
  }

  if (role === "owner") {
    sections.push({
      key: "operations",
      label: "Operations",
      content: (
        <>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <SectionHeader>Training mode</SectionHeader>
            <TrainingModeForm initialEnabled={trainingMode} />
          </div>
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <SectionHeader>Register</SectionHeader>
            <ShowPhotosForm initialEnabled={showItemPhotos} />
          </div>
          {business.industry === "transportation" && (
            <div className="bg-card border border-border rounded-lg p-6">
              <SectionHeader>Features</SectionHeader>
              <DriversSettingCard
                initialEnabled={business.drivers_enabled !== false}
              />
            </div>
          )}
        </>
      ),
    });
  }

  sections.push({
    key: "integrations",
    label: "Integrations",
    content: (
      <>
        {role === "owner" && (
          <div className="bg-card border border-border rounded-lg p-6 mb-4">
            <SectionHeader>Square</SectionHeader>
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
        )}
        <GoogleAdsCard />
        <LeadInboxCard />
      </>
    ),
  });

  sections.push({
    key: "notifications",
    label: "Notifications",
    content: (
      <div className="mb-4">
        <NotificationsCard initialPrefs={notifPrefs} />
      </div>
    ),
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and account."
      />
      <SettingsTabs sections={sections} />
    </div>
  );
}