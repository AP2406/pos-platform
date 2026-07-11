import type { ReactNode } from "react";
import Link from "next/link";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeader } from "../_components/ui";
import { SettingsForm } from "./settings-form";
import { TaxCurrencyForm } from "./tax-currency-form";
import { TaxRatesCard } from "./tax-rates-card";
import { OrderNumberCard } from "./order-number-card";
import { AvailabilityCard } from "./availability-card";
import { listAvailabilityWindows } from "./availability-actions";
import { TrainingModeForm } from "./training-mode-form";
import { ShowPhotosForm } from "./show-photos-form";
import { StaffCard } from "./staff-card";
import { RolesCard } from "./roles-card";
import { listRoles } from "./roles-actions";
import { DayCloseCard } from "./day-close-card";
import { CoaCard } from "./coa-card";
import { BasisCard } from "./basis-card";
import { resolveCoa, COA_DEFAULTS, type CoaKey } from "../accounting/journal";
import { OvertimeCard } from "./overtime-card";
import { parseOvertime } from "@/lib/services/overtime";
import { OnlineBookingCard } from "./online-booking-card";
import { KdsCard } from "./kds-card";
import { RegisterBehaviorCard } from "./register-behavior-card";
import type { RegisterPrefs } from "./register-prefs-actions";
import { ScheduledReportCard } from "./scheduled-report-card";
import { ClockEnforcementCard } from "./clock-enforcement-card";
import { LaborTargetCard } from "./labor-target-card";
import { ExceptionCard } from "./exception-card";
import { parseThresholds } from "@/lib/services/exception-thresholds";
import { FloorCard } from "./floor-card";
import { SectionsCard } from "./sections-card";
import { listSections, listAssignableTables } from "../pos/sections-actions";
import { TableAgingCard } from "./table-aging-card";
import { StationsCard } from "./stations-card";
import { listKitchenStations } from "../kitchen/stations-actions";
import { GuestOrderingCard } from "./guest-ordering-card";
import { KioskCard } from "./kiosk-card";
import { OnlineOrderingCard } from "./online-ordering-card";
import { CfdCard } from "./cfd-card";
import { ServiceChargeCard } from "./service-charge-card";
import { SplitCard } from "./split-card";
import { LoyaltyCard } from "./loyalty-card";
import { getLoyaltySettings } from "../pos/loyalty-actions";
import { GiftCardsCard } from "./gift-cards-card";
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
    .select("id, name, rate, jurisdiction")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const taxRates = (taxRatesData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    rate: Number(r.rate),
    jurisdiction: (r.jurisdiction as string | null) ?? null,
  }));

  // Current order/bill counter — the next sale is last_sale_number + 1 (1 if unset).
  const { data: counterRow } = await supabase
    .from("order_counters")
    .select("last_sale_number")
    .eq("business_id", business.id)
    .maybeSingle();
  const nextSaleNumber = Number((counterRow as { last_sale_number?: number } | null)?.last_sale_number ?? 0) + 1;

  // Menu-hours (dayparting) editor data: existing windows + the item/category pickers.
  const availabilityWindows = await listAvailabilityWindows();
  const { data: availItemsData } = await supabase
    .from("catalog_items")
    .select("id, name, category")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });
  const availabilityItems = (availItemsData ?? []).map((i) => ({ id: i.id as string, name: i.name as string }));
  const availabilityCategories = Array.from(
    new Set((availItemsData ?? []).map((i) => (i.category as string | null) || "").filter((c) => c))
  ).sort();

  const trainingMode =
    (business as { training_mode?: boolean }).training_mode === true;

  const scb = business as {
    service_charge_enabled?: boolean;
    service_charge_pct?: number;
    service_charge_auto_party?: number;
    service_charge_post_tax?: boolean;
    service_charge_label?: string;
  };
  const serviceChargeSettings = {
    enabled: scb.service_charge_enabled === true,
    pct: Number(scb.service_charge_pct) || 0,
    autoParty: Number(scb.service_charge_auto_party) || 0,
    postTax: scb.service_charge_post_tax === true,
    label: (scb.service_charge_label || "Service charge").toString(),
  };
  const showServiceCharge = hasFloorService(business);

  const splitb = business as { split_settlement_mode?: string; split_allow_units?: boolean };
  const splitSettings = {
    settlementMode: (splitb.split_settlement_mode === "informational" ? "informational" : "separate") as "separate" | "informational",
    allowUnits: splitb.split_allow_units === true,
  };
  const showSplit = hasFloorService(business);

  const ta = ((business as { settings?: { table_aging?: { yellow_min?: number; red_min?: number } } }).settings?.table_aging) ?? {};
  const tableAging = { yellowMin: Number(ta.yellow_min) || 45, redMin: Number(ta.red_min) || 90 };

  const showItemPhotos =
    (business as { show_item_photos?: boolean }).show_item_photos !== false;

  let staffList: { id: string; name: string; role: string; role_id: string | null; is_active: boolean; has_pin: boolean; pay_rate: number | null; overrides: Record<string, boolean> }[] = [];
  let rolesList: Awaited<ReturnType<typeof listRoles>> = [];
  if (role === "owner" || role === "manager") {
    // Migration-resilient: permission_overrides (0070) may not exist yet.
    const fetchStaff = async (cols: string) => supabase.from("staff_members").select(cols).eq("business_id", business.id).order("created_at", { ascending: true });
    const full = await fetchStaff("id, name, role, role_id, is_active, pin_hash, pay_rate, permission_overrides");
    const sdata = (full.error ? (await fetchStaff("id, name, role, role_id, is_active, pin_hash, pay_rate")).data : full.data) as Record<string, unknown>[] | null;
    staffList = ((sdata ?? []) as Record<string, unknown>[]).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      role: s.role as string,
      role_id: (s.role_id as string | null) ?? null,
      is_active: s.is_active as boolean,
      has_pin: !!s.pin_hash,
      pay_rate: (s.pay_rate as number | null) ?? null,
      overrides: (s.permission_overrides ?? {}) as Record<string, boolean>,
    }));
    rolesList = await listRoles();
  }

  const daySettings = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const registerPrefs = (daySettings.register ?? {}) as Partial<RegisterPrefs>;
  const dayCutoff = typeof daySettings.business_day_cutoff === "string" ? daySettings.business_day_cutoff : "00:00";
  const dayEmails = Array.isArray(daySettings.z_report_emails)
    ? (daySettings.z_report_emails as unknown[]).filter((e): e is string => typeof e === "string")
    : [];
  const dayBlind = daySettings.blind_close === true;
  const largeTxnEmail = ((daySettings.alerts ?? {}) as Record<string, unknown>).large_txn_email !== false;
  const coa = resolveCoa(daySettings);
  const ot = parseOvertime(daySettings);
  const onlineBookingOn = daySettings.online_booking_enabled === true;
  const kdsCfg = (daySettings.kds ?? {}) as { warnMin?: unknown; lateMin?: unknown };
  const kdsWarnMin = Number(kdsCfg.warnMin) > 0 ? Number(kdsCfg.warnMin) : 10;
  const kdsLateMin = Number(kdsCfg.lateMin) > kdsWarnMin ? Number(kdsCfg.lateMin) : 18;
  const autoCourse = daySettings.auto_course === true;
  const kdsLang = typeof daySettings.kds_lang === "string" ? (daySettings.kds_lang as string) : "en";
  const schedRep = (daySettings.scheduled_report ?? {}) as { enabled?: unknown; frequency?: unknown; weekday?: unknown; recipients?: unknown };
  const schedReportEnabled = schedRep.enabled === true;
  const schedReportFreq = schedRep.frequency === "weekly" ? "weekly" : "daily";
  const schedReportWeekday = Number(schedRep.weekday) >= 0 && Number(schedRep.weekday) <= 6 ? Number(schedRep.weekday) : 1;
  const schedReportRecipients = Array.isArray(schedRep.recipients)
    ? (schedRep.recipients as unknown[]).filter((e): e is string => typeof e === "string").join(", ")
    : "";
  const clockEnf = (daySettings.clock_enforcement ?? {}) as { enabled?: unknown; graceMin?: unknown };
  const clockEnfEnabled = clockEnf.enabled === true;
  const clockEnfGrace = Number(clockEnf.graceMin) >= 0 ? Number(clockEnf.graceMin) : 5;
  const laborTarget = (daySettings.labor_target ?? {}) as { enabled?: unknown; targetPct?: unknown };
  const laborTargetEnabled = laborTarget.enabled === true;
  const laborTargetPct = Number(laborTarget.targetPct) > 0 ? Number(laborTarget.targetPct) : 30;
  const kdsPrinterFallback = daySettings.kds_printer_fallback === true;
  const bookingUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.surgetechpos.com") + "/book/" + business.id;
  const coaRows = (Object.keys(COA_DEFAULTS) as CoaKey[]).map((k) => ({ key: k, name: coa[k].name, code: coa[k].code }));
  const accountingBasis = (daySettings.accounting_basis === "cash" ? "cash" : "accrual") as "accrual" | "cash";
  const legalEntity = typeof daySettings.legal_entity === "string" ? (daySettings.legal_entity as string) : "";
  const exTh = parseThresholds(daySettings);

  const showFloor =
    hasFloorService(business) && (role === "owner" || role === "manager");
  let floorPlans: Awaited<ReturnType<typeof listFloorPlans>> = [];
  let floorElements: Awaited<ReturnType<typeof listFloor>>["elements"] = [];
  let sectionsList: Awaited<ReturnType<typeof listSections>> = [];
  let assignableTables: Awaited<ReturnType<typeof listAssignableTables>> = [];
  let stationsList: Awaited<ReturnType<typeof listKitchenStations>> = [];
  const chairMode: "follow" | "editable" =
    (business as { floor_chair_mode?: string }).floor_chair_mode === "editable" ? "editable" : "follow";
  if (showFloor) {
    floorPlans = await listFloorPlans();
    if (floorPlans[0]) floorElements = (await listFloor(floorPlans[0].id)).elements;
    sectionsList = await listSections();
    assignableTables = await listAssignableTables();
    stationsList = await listKitchenStations();
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

  const canLoyalty = role === "owner" || role === "manager";
  const loyaltySettings = canLoyalty ? await getLoyaltySettings() : null;

  const sections: { key: string; label: string; content: ReactNode }[] = [];

  sections.push({
    key: "general",
    label: "General",
    content: (
      <>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
          <SectionHeader>Business profile</SectionHeader>
          <SettingsForm
            initialName={business.name}
            initialTimezone={business.timezone || "America/Toronto"}
          />
        </div>
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
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
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
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
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Tax and currency</SectionHeader>
            <TaxCurrencyForm
              initialTaxPercent={taxPercent}
              initialCurrency={business.currency || "CAD"}
            />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Additional tax rates</SectionHeader>
            <TaxRatesCard initialRates={taxRates} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Order &amp; bill numbers</SectionHeader>
            <OrderNumberCard nextNumber={nextSaleNumber} canManage={role === "owner" || role === "manager"} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Menu hours (dayparting)</SectionHeader>
            <AvailabilityCard
              initialWindows={availabilityWindows}
              items={availabilityItems}
              categories={availabilityCategories}
              canManage={role === "owner" || role === "manager"}
            />
          </div>
          {showServiceCharge && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Service charge</SectionHeader>
              <ServiceChargeCard initial={serviceChargeSettings} />
            </div>
          )}
          {showSplit && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
              <SectionHeader>Check splitting</SectionHeader>
              <SplitCard initial={splitSettings} />
            </div>
          )}
        </>
      ),
    });
  }

  if (role === "owner") {
    sections.push({
      key: "receipts",
      label: "Receipts",
      content: (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
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
      <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
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
        <>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Staff and PINs</SectionHeader>
            <StaffCard
              initialStaff={staffList}
              roles={rolesList.map((r) => ({ id: r.id, name: r.name, key: r.key, permissions: r.permissions }))}
            />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Roles &amp; permissions</SectionHeader>
            <RolesCard initialRoles={rolesList} />
          </div>
        </>
      ),
    });
  }

  if (showFloor) {
    sections.push({
      key: "floor",
      label: "Floor",
      content: (
        <>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Floor plan</SectionHeader>
            <FloorCard initialPlans={floorPlans} initialElements={floorElements} initialChairMode={chairMode} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Server sections</SectionHeader>
            <SectionsCard initialSections={sectionsList} tables={assignableTables} staff={staffList.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name }))} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Table timers</SectionHeader>
            <TableAgingCard initial={tableAging} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Kitchen stations</SectionHeader>
            <StationsCard initial={stationsList} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Guest ordering (QR)</SectionHeader>
            <GuestOrderingCard
              businessId={business.id}
              initialEnabled={(business as { guest_ordering_enabled?: boolean }).guest_ordering_enabled === true}
              tables={floorElements.filter((e) => e.kind === "table" || e.kind === "booth").map((e) => ({ id: e.id, label: e.label ?? "Table" }))}
            />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Self-ordering kiosk</SectionHeader>
            <KioskCard
              businessId={business.id}
              initialEnabled={(business as { kiosk_ordering_enabled?: boolean }).kiosk_ordering_enabled === true}
            />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Online pickup ordering</SectionHeader>
            <OnlineOrderingCard
              businessId={business.id}
              initialEnabled={(business as { online_ordering_enabled?: boolean }).online_ordering_enabled === true}
            />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Customer display</SectionHeader>
            <CfdCard businessId={business.id} />
          </div>
        </>
      ),
    });
  }

  if (role === "owner") {
    sections.push({
      key: "operations",
      label: "Operations",
      content: (
        <>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Training mode</SectionHeader>
            <TrainingModeForm initialEnabled={trainingMode} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Register</SectionHeader>
            <ShowPhotosForm initialEnabled={showItemPhotos} />
          </div>
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Day close &amp; Z-report</SectionHeader>
              <DayCloseCard cutoff={dayCutoff} emails={dayEmails} blind={dayBlind} largeTxnEmail={largeTxnEmail} />
            </div>
          )}
          {hasFloorService(business) && (role === "owner" || role === "manager") && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Scheduled report email</SectionHeader>
              <ScheduledReportCard enabled={schedReportEnabled} frequency={schedReportFreq} weekday={schedReportWeekday} recipients={schedReportRecipients} />
            </div>
          )}
          {hasFloorService(business) && (role === "owner" || role === "manager") && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Schedule-enforced clock-in</SectionHeader>
              <ClockEnforcementCard enabled={clockEnfEnabled} graceMin={clockEnfGrace} />
            </div>
          )}
          {hasFloorService(business) && (role === "owner" || role === "manager") && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Labor target alert</SectionHeader>
              <LaborTargetCard enabled={laborTargetEnabled} targetPct={laborTargetPct} />
            </div>
          )}
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Exception thresholds</SectionHeader>
              <ExceptionCard
                voidPct={Math.round(exTh.voidRate * 1000) / 10}
                compPct={Math.round(exTh.compRate * 1000) / 10}
                discountPct={Math.round(exTh.discountRate * 1000) / 10}
                refundPct={Math.round(exTh.refundRate * 1000) / 10}
                alertVoidAmount={exTh.alertVoidAmount}
              />
            </div>
          )}
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Chart of accounts (QBO/Xero export)</SectionHeader>
              <CoaCard rows={coaRows} />
            </div>
          )}
          {hasFloorService(business) && (role === "owner" || role === "manager") && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Accounting basis</SectionHeader>
              <BasisCard basis={accountingBasis} legalEntity={legalEntity} />
            </div>
          )}
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Overtime</SectionHeader>
              <OvertimeCard weeklyHours={ot.weeklyHours} multiplier={ot.multiplier} />
            </div>
          )}
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Online booking</SectionHeader>
              <OnlineBookingCard enabled={onlineBookingOn} bookingUrl={bookingUrl} />
            </div>
          )}
          {hasFloorService(business) && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
              <SectionHeader>Kitchen display (KDS)</SectionHeader>
              <KdsCard warnMin={kdsWarnMin} lateMin={kdsLateMin} autoCourse={autoCourse} lang={kdsLang} printerFallback={kdsPrinterFallback} />
            </div>
          )}

          <div className="mb-4">
            <RegisterBehaviorCard initial={registerPrefs} />
          </div>
          {business.industry === "transportation" && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
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

  if (canLoyalty && loyaltySettings) {
    sections.push({
      key: "loyalty",
      label: "Loyalty",
      content: (
        <>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
            <SectionHeader>Loyalty &amp; rewards</SectionHeader>
            <LoyaltyCard initial={loyaltySettings} />
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6">
            <SectionHeader>Gift cards</SectionHeader>
            <GiftCardsCard />
          </div>
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
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 mb-4">
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
    // Capped width + centered so the sub-nav (~224px) and a comfortable ~640px
    // content column read balanced on wide screens instead of being pinned left
    // with the right half empty.
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile and account."
      />
      {hasFloorService(business) && (
        <Link href="/app/settings/customization" className="block bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-4 hover:bg-accent/40">
          <div className="font-medium text-sm">Customization →</div>
          <div className="text-xs text-muted-foreground mt-0.5">Shape settings, access, workflow, layout &amp; branding at the business / location / role / user level — with sensible defaults.</div>
        </Link>
      )}
      <SettingsTabs sections={sections} />
    </div>
  );
}