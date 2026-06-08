import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { CatalogClient } from "./catalog-client";

export default async function CatalogPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, is_active, taxable, tax_rate_id, barcode")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

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
    .select("id, name, rate")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

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

  const items = (itemsData ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price),
    category: (i.category as string | null) ?? null,
    is_active: i.is_active as boolean,
    taxable: (i.taxable as boolean | null) ?? true,
    tax_rate_id: (i.tax_rate_id as string | null) ?? null,
    barcode: (i.barcode as string | null) ?? null,
    variations: varsByItem[i.id as string] ?? [],
    modifiers: modsByItem[i.id as string] ?? [],
  }));

  const taxRates = (ratesData ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    rate: Number(r.rate),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          The products and services you sell at checkout.
        </p>
      </div>
      <CatalogClient initialItems={items} taxRates={taxRates} />
    </div>
  );
}