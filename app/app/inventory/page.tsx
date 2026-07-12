import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { InventoryClient } from "./inventory-client";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
function money(n: number): string {
  return "$" + r2(n).toFixed(2);
}

export default async function InventoryPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const [{ data }, { data: ingRows }] = await Promise.all([
    supabase
      .from("catalog_items")
      .select("id, name, track_inventory, stock_qty, reorder_point, barcode, is_active")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    // C2: on-hand inventory valuation — tracked raw ingredients × unit cost.
    supabase
      .from("ingredients")
      .select("id, name, unit, cost, stock_qty, reorder_point, track_stock, is_active")
      .eq("business_id", business.id)
      .eq("track_stock", true)
      .eq("is_active", true),
  ]);

  const items = (data ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    track_inventory: !!i.track_inventory,
    stock_qty: Number(i.stock_qty) || 0,
    reorder_point: Number(i.reorder_point) || 0,
    barcode: (i.barcode as string | null) ?? null,
    is_active: i.is_active as boolean,
  }));

  // C2: standing $ value of on-hand inventory (Σ stock_qty × cost), with the
  // highest-value lines surfaced and a count of ingredients at/under reorder.
  const valuation = (ingRows ?? []).map((g) => {
    const qty = Number(g.stock_qty) || 0;
    const cost = Number(g.cost) || 0;
    return {
      id: g.id as string,
      name: (g.name as string) || "Ingredient",
      unit: (g.unit as string) || "",
      qty,
      cost,
      value: r2(qty * cost),
      low: qty <= (Number(g.reorder_point) || 0) && (Number(g.reorder_point) || 0) > 0,
    };
  });
  const totalValue = r2(valuation.reduce((s, v) => s + v.value, 0));
  const lowCount = valuation.filter((v) => v.low).length;
  const topValue = [...valuation].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Turn on tracking per item, then receive or adjust counts. Items at or
            below their low-stock level are flagged.
          </p>
        </div>
        <Link
          href="/app/inventory/low-stock"
          className="shrink-0 text-sm rounded-md border border-border px-3 py-2 hover:bg-accent"
        >
          Low-stock report
        </Link>
      </div>

      {valuation.length > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-3">
            <div>
              <div className="text-xs text-muted-foreground">On-hand inventory value</div>
              <div className="text-2xl font-semibold tabular-nums">{money(totalValue)}</div>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {valuation.length} tracked ingredient{valuation.length === 1 ? "" : "s"}
              {lowCount > 0 && <span className="block text-amber-600 font-medium">{lowCount} at/below reorder</span>}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-1.5 font-medium">Ingredient</th>
                <th className="py-1.5 font-medium text-right">On hand</th>
                <th className="py-1.5 font-medium text-right">Unit cost</th>
                <th className="py-1.5 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {topValue.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0">
                  <td className="py-1.5">
                    {v.low && <span className="mr-1.5 text-amber-600">⚠</span>}
                    {v.name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{v.qty.toLocaleString()} {v.unit}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{money(v.cost)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{money(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {valuation.length > topValue.length && (
            <div className="text-[11px] text-muted-foreground mt-2">
              Showing the {topValue.length} highest-value of {valuation.length} tracked ingredients. Manage ingredient costs &amp; stock under Recipes.
            </div>
          )}
        </div>
      )}

      <InventoryClient initialItems={items} />
    </div>
  );
}