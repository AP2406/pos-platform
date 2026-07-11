import type { createClient } from "@/lib/supabase/server";
import type { ItemTaxMeta } from "./tax-compute";

// Load the per-item tax metadata (multi-tax) + rate maps for a set of catalog item
// ids, in the shape computeCartTax expects. One place, so the register-close, split
// and QR-guest money paths all read taxes identically. The catalog_item_taxes
// junction is the source of truth; an item with no junction rows falls back to its
// legacy single tax_rate_id (covers rows created before the junction backfill).
export async function loadItemTaxMeta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  itemIds: string[]
): Promise<{
  itemTaxMeta: Record<string, ItemTaxMeta>;
  rateFracById: Record<string, number>;
  rateNameById: Record<string, string>;
}> {
  const itemTaxMeta: Record<string, ItemTaxMeta> = {};
  const rateFracById: Record<string, number> = {};
  const rateNameById: Record<string, string> = {};
  const ids = Array.from(new Set(itemIds.filter((x): x is string => !!x)));
  if (ids.length === 0) return { itemTaxMeta, rateFracById, rateNameById };

  const { data: itemRows } = await supabase
    .from("catalog_items")
    .select("id, taxable, tax_rate_id")
    .eq("business_id", businessId)
    .in("id", ids);
  for (const r of itemRows ?? []) {
    itemTaxMeta[r.id as string] = { taxable: (r.taxable as boolean | null) ?? true, tax_rate_ids: [] };
  }

  const { data: linkRows } = await supabase
    .from("catalog_item_taxes")
    .select("catalog_item_id, tax_rate_id")
    .eq("business_id", businessId)
    .in("catalog_item_id", ids);
  for (const r of linkRows ?? []) {
    const m = itemTaxMeta[r.catalog_item_id as string];
    if (m && r.tax_rate_id) m.tax_rate_ids.push(r.tax_rate_id as string);
  }

  // Fallback for any item with no junction rows: keep honoring its legacy single rate.
  for (const r of itemRows ?? []) {
    const m = itemTaxMeta[r.id as string];
    const legacy = (r.tax_rate_id as string | null) ?? null;
    if (m && m.tax_rate_ids.length === 0 && legacy) m.tax_rate_ids.push(legacy);
  }

  const usedIds = Array.from(new Set(Object.values(itemTaxMeta).flatMap((m) => m.tax_rate_ids)));
  if (usedIds.length > 0) {
    const { data: rateRows } = await supabase
      .from("tax_rates")
      .select("id, name, rate")
      .eq("business_id", businessId)
      .in("id", usedIds);
    for (const r of rateRows ?? []) {
      rateFracById[r.id as string] = (Number(r.rate) || 0) / 100;
      rateNameById[r.id as string] = r.name as string;
    }
  }

  return { itemTaxMeta, rateFracById, rateNameById };
}
