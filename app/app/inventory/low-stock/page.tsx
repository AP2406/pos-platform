import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { ExportButton } from "../../reports/export-button";

export const dynamic = "force-dynamic";

// Low-stock / reorder report: one unified, read-only list of everything at or
// below its reorder point — tracked ingredients (recipes) AND tracked catalog
// items — sorted by how far short it is, with a suggested reorder qty and CSV
// export. Consolidates what today is scattered across the dashboard tile (items
// only), purchasing "suggested ordering", and the inventory valuation table.
// Strictly read-only; no writes, no migration, no money/permission path.
export default async function LowStockReportPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const [{ data: ingRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from("ingredients")
      .select("id, name, unit, cost, stock_qty, reorder_point, track_stock, is_active")
      .eq("business_id", business.id)
      .eq("track_stock", true)
      .eq("is_active", true),
    supabase
      .from("catalog_items")
      .select("id, name, stock_qty, reorder_point, track_inventory, is_active")
      .eq("business_id", business.id)
      .eq("track_inventory", true)
      .eq("is_active", true),
  ]);

  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

  type Row = {
    kind: "Ingredient" | "Item";
    name: string;
    unit: string;
    onHand: number;
    reorderAt: number;
    shortBy: number;
    suggested: number;
  };

  // "Low" = a real threshold is set (reorder_point > 0) and on-hand is at/below it.
  // Items with no threshold configured are excluded so the report stays signal.
  const rows: Row[] = [];
  for (const g of ingRows ?? []) {
    const onHand = Number(g.stock_qty) || 0;
    const reorderAt = Number(g.reorder_point) || 0;
    if (reorderAt > 0 && onHand <= reorderAt) {
      rows.push({
        kind: "Ingredient",
        name: (g.name as string) || "Ingredient",
        unit: (g.unit as string) || "",
        onHand,
        reorderAt,
        shortBy: r2(reorderAt - onHand),
        suggested: Math.max(1, r2(reorderAt - onHand)),
      });
    }
  }
  for (const i of itemRows ?? []) {
    const onHand = Number(i.stock_qty) || 0;
    const reorderAt = Number(i.reorder_point) || 0;
    if (reorderAt > 0 && onHand <= reorderAt) {
      rows.push({
        kind: "Item",
        name: (i.name as string) || "Item",
        unit: "unit",
        onHand,
        reorderAt,
        shortBy: r2(reorderAt - onHand),
        suggested: Math.max(1, Math.round(reorderAt - onHand)),
      });
    }
  }

  // Most-short first; out-of-stock (on-hand 0) floats to the top within that.
  rows.sort((a, b) => b.shortBy - a.shortBy || a.onHand - b.onHand || a.name.localeCompare(b.name));

  const outCount = rows.filter((r) => r.onHand <= 0).length;

  const exportRows: (string | number)[][] = [
    ["Type", "Name", "On hand", "Unit", "Reorder at", "Short by", "Suggested order"],
    ...rows.map((r) => [r.kind, r.name, r.onHand, r.unit, r.reorderAt, r.shortBy, r.suggested]),
  ];
  const exportFilename = "surge-low-stock.csv";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Low-stock report</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every tracked ingredient and item at or below its reorder point, most short first.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/app/inventory" className="text-sm rounded-md border border-border px-3 py-2 hover:bg-accent">
            Inventory
          </Link>
          <ExportButton rows={exportRows} filename={exportFilename} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-6 text-sm text-muted-foreground">
          Nothing to reorder — every tracked ingredient and item is above its reorder point. Set low-stock levels
          on ingredients under <Link href="/app/recipes" className="underline">Recipes</Link> and on items under{" "}
          <Link href="/app/inventory" className="underline">Inventory</Link>.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-sm">
            <span className="text-amber-600 font-medium">{rows.length} at/below reorder</span>
            {outCount > 0 && <span className="text-red-600 font-medium">{outCount} out of stock</span>}
          </div>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 px-4 font-medium">Name</th>
                  <th className="py-2 px-4 font-medium">Type</th>
                  <th className="py-2 px-4 font-medium text-right">On hand</th>
                  <th className="py-2 px-4 font-medium text-right">Reorder at</th>
                  <th className="py-2 px-4 font-medium text-right">Short by</th>
                  <th className="py-2 px-4 font-medium text-right">Suggested order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const out = r.onHand <= 0;
                  return (
                    <tr key={r.kind + idx} className="border-b border-border last:border-0">
                      <td className="py-2 px-4 font-medium">
                        <span className={"mr-1.5 " + (out ? "text-red-600" : "text-amber-600")}>●</span>
                        {r.name}
                      </td>
                      <td className="py-2 px-4 text-muted-foreground">{r.kind}</td>
                      <td className={"py-2 px-4 text-right tabular-nums " + (out ? "text-red-600 font-medium" : "")}>
                        {r.onHand.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-muted-foreground">
                        {r.reorderAt.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums">{r.shortBy.toLocaleString()} {r.unit}</td>
                      <td className="py-2 px-4 text-right tabular-nums font-medium">{r.suggested.toLocaleString()} {r.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Create purchase orders from these under <Link href="/app/purchasing" className="underline">Purchasing</Link> (suggested ordering).
          </p>
        </>
      )}
    </div>
  );
}
