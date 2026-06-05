import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { RegisterClient } from "./register-client";
import { getActiveStaff } from "./staff-session";
import type { ReceiptSettings } from "./receipt-template";

export default async function PosPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, taxable, tax_rate_id")
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
    .select("receipt_settings")
    .eq("id", business.id)
    .maybeSingle();
  const receiptSettings =
    (rsRow?.receipt_settings as Partial<ReceiptSettings> | null) ?? null;

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
      variations: varsByItem[i.id as string] ?? [],
      modifiers: modsByItem[i.id as string] ?? [],
    };
  });

  const taxRate = defaultFrac;

  const trainingMode =
    (business as { training_mode?: boolean }).training_mode === true;

  return (
    <div>
      {trainingMode && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 font-medium">
          Training mode is on &mdash; these sales are practice and won&apos;t count toward your reports or cash drawer.
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Register</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tap items to build a sale, then charge.
        </p>
      </div>
      <RegisterClient
        items={items}
        taxRate={taxRate}
        businessName={business.name}
        hasStaff={hasStaff}
        activeStaff={activeStaff}
        receiptSettings={receiptSettings}
      />
    </div>
  );
}