import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { RegisterClient } from "./register-client";
import { FloorClient } from "./floor-client";
import { getActiveStaff } from "./staff-session";
import { listFloor, listFloorPlans } from "../floor/floor-actions";
import { listOpenTableTickets, listOpenTogoTickets } from "./ticket-actions";
import { listCourses } from "./courses-actions";
import { hasFloorService } from "@/lib/modules/modes";
import type { ReceiptSettings } from "./receipt-template";

export default async function PosPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, taxable, tax_rate_id, image_url, out_of_stock, default_course_id")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: varsData } = await supabase
    .from("catalog_item_variations")
    .select("id, catalog_item_id, name, price")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: modsData } = await supabase
    .from("catalog_item_modifiers")
    .select("id, catalog_item_id, name, price")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: ratesData } = await supabase
    .from("tax_rates")
    .select("id, rate")
    .eq("business_id", business.id)
    .eq("is_active", true);

  const { data: staffRows } = await supabase
    .from("staff_members")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_active", true);
  const hasStaff = (staffRows ?? []).length > 0;
  const activeStaff = await getActiveStaff();

  const { data: rsRow } = await supabase
    .from("businesses")
    .select("receipt_settings, show_item_photos, category_colors")
    .eq("id", business.id)
    .maybeSingle();
  const receiptSettings =
    (rsRow?.receipt_settings as Partial<ReceiptSettings> | null) ?? null;
  const showItemPhotos =
    (rsRow?.show_item_photos as boolean | null) !== false;
  const categoryColors =
    (rsRow?.category_colors as Record<string, string> | null) ?? {};

  const { data: openDrawer } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  const drawerOpen = !!openDrawer;

  let defaultFrac = Number(business.default_tax_rate) || 0;
  if (defaultFrac > 1) defaultFrac = defaultFrac / 100;

  const rateFracById: Record<string, number> = {};
  for (const r of ratesData ?? []) {
    rateFracById[r.id as string] = (Number(r.rate) || 0) / 100;
  }

  const varsByItem: Record<string, { id: string; name: string; price: number }[]> = {};
  for (const v of varsData ?? []) {
    const itemId = v.catalog_item_id as string;
    if (!varsByItem[itemId]) varsByItem[itemId] = [];
    varsByItem[itemId].push({
      id: v.id as string,
      name: v.name as string,
      price: Number(v.price),
    });
  }

  const modsByItem: Record<string, { id: string; name: string; price: number }[]> = {};
  for (const m of modsData ?? []) {
    const itemId = m.catalog_item_id as string;
    if (!modsByItem[itemId]) modsByItem[itemId] = [];
    modsByItem[itemId].push({
      id: m.id as string,
      name: m.name as string,
      price: Number(m.price),
    });
  }

  const items = (itemsData ?? []).map((i) => {
    const rid = (i.tax_rate_id as string | null) ?? null;
    const taxFrac =
      rid && rateFracById[rid] !== undefined ? rateFracById[rid] : defaultFrac;
    return {
      id: i.id as string,
      name: i.name as string,
      price: Number(i.price),
      category: (i.category as string | null) ?? null,
      taxable: (i.taxable as boolean | null) ?? true,
      taxFrac: taxFrac,
      image_url: (i.image_url as string | null) ?? null,
      out_of_stock: (i.out_of_stock as boolean | null) ?? false,
      default_course_id: (i.default_course_id as string | null) ?? null,
      variations: varsByItem[i.id as string] ?? [],
      modifiers: modsByItem[i.id as string] ?? [],
    };
  });

  const taxRate = defaultFrac;

  const trainingMode =
    (business as { training_mode?: boolean }).training_mode === true;

  // Service charge + check splitting are full-service features. For QSR / retail
  // / the transportation register, leave these undefined so the register renders
  // exactly as before (no service-charge line, no Split control).
  const isFullService = hasFloorService(business);
  const b = business as {
    service_charge_enabled?: boolean;
    service_charge_pct?: number;
    service_charge_auto_party?: number;
    service_charge_post_tax?: boolean;
    service_charge_label?: string;
  };
  const serviceCharge = isFullService
    ? {
        enabled: b.service_charge_enabled === true,
        pct: Number(b.service_charge_pct) || 0,
        autoParty: Number(b.service_charge_auto_party) || 0,
        postTax: b.service_charge_post_tax === true,
        label: (b.service_charge_label || "Service charge").toString(),
      }
    : undefined;

  const splitSettings = isFullService
    ? {
        settlementMode: ((business as { split_settlement_mode?: string }).split_settlement_mode === "informational" ? "informational" : "separate") as "separate" | "informational",
        allowUnits: (business as { split_allow_units?: boolean }).split_allow_units === true,
      }
    : undefined;

  // Coursing (P0-1) is full-service only; listCourses seeds the default four.
  const courses = isFullService ? await listCourses() : undefined;

  const registerProps = {
    items,
    taxRate,
    businessName: business.name,
    hasStaff,
    activeStaff,
    receiptSettings,
    showItemPhotos,
    categoryColors,
    serviceCharge,
    splitSettings,
    courses,
  };

  // Full-service restaurants get the table floor first; every other mode (and
  // the transportation register) renders the flat register exactly as before.
  const showFloor = hasFloorService(business);
  let floorPlans: Awaited<ReturnType<typeof listFloorPlans>> = [];
  let floorElements: Awaited<ReturnType<typeof listFloor>>["elements"] = [];
  let openTables: Awaited<ReturnType<typeof listOpenTableTickets>> = [];
  let openTogo: Awaited<ReturnType<typeof listOpenTogoTickets>> = [];
  let serverStaff: { id: string; name: string }[] = [];
  if (showFloor) {
    floorPlans = await listFloorPlans();
    if (floorPlans[0]) floorElements = (await listFloor(floorPlans[0].id)).elements;
    openTables = await listOpenTableTickets();
    openTogo = await listOpenTogoTickets();
    const { data: staffData } = await supabase
      .from("staff_members")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name", { ascending: true });
    serverStaff = (staffData ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
  }

  return (
    <div className="h-full flex flex-col">
      {trainingMode && (
        <div className="shrink-0 flex items-center gap-2 border-b border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-600 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          Training mode is on &mdash; these sales are practice and won&apos;t count toward your reports or the till.
        </div>
      )}

      {!trainingMode && !drawerOpen && (
        <div className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-500 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          You haven&apos;t started the day &mdash; cash sales won&apos;t be counted in an end-of-day till total.
          <Link href="/app/pos/drawer" className="underline underline-offset-2 hover:opacity-80">
            Start the day
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {showFloor ? (
          <FloorClient
            register={registerProps}
            plans={floorPlans}
            initialElements={floorElements}
            initialOpen={openTables}
            initialTogo={openTogo}
            staff={serverStaff}
          />
        ) : (
          <RegisterClient {...registerProps} />
        )}
      </div>
    </div>
  );
}