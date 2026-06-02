import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { RegisterClient } from "./register-client";

export default async function PosPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: itemsData } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, taxable")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: varsData } = await supabase
    .from("catalog_item_variations")
    .select("id, catalog_item_id, name, price")
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

  const items = (itemsData ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price),
    category: (i.category as string | null) ?? null,
    taxable: (i.taxable as boolean | null) ?? true,
    variations: varsByItem[i.id as string] ?? [],
  }));

  let taxRate = Number(business.default_tax_rate) || 0;
  if (taxRate > 1) taxRate = taxRate / 100;

  const trainingMode =
    (business as { training_mode?: boolean }).training_mode === true;

  return (
    <div>
      {trainingMode && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 font-medium">
          Training mode is on — these sales are practice and won&apos;t count toward your reports or cash drawer.
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Register</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tap items to build a sale, then charge.
        </p>
      </div>
      <RegisterClient items={items} taxRate={taxRate} businessName={business.name} />
    </div>
  );
}