import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalog_items")
    .select("id, name, track_inventory, stock_qty, reorder_point, barcode, is_active")
    .eq("business_id", business.id)
    .order("name", { ascending: true });

  const items = (data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    track_inventory: !!i.track_inventory,
    stock_qty: Number(i.stock_qty) || 0,
    reorder_point: Number(i.reorder_point) || 0,
    barcode: (i.barcode as string | null) ?? null,
    is_active: i.is_active as boolean,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Turn on tracking per item, then receive or adjust counts. Items at or
          below their low-stock level are flagged.
        </p>
      </div>
      <InventoryClient initialItems={items} />
    </div>
  );
}