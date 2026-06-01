import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { CatalogClient } from "./catalog-client";

export default async function CatalogPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, is_active")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  const items = (data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    price: Number(i.price),
    category: (i.category as string | null) ?? null,
    is_active: i.is_active as boolean,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <p className="text-muted-foreground text-sm mt-1">
          The products and services you sell at checkout.
        </p>
      </div>
      <CatalogClient initialItems={items} />
    </div>
  );
}