import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { WasteClient } from "./waste-client";

const RANGES = [7, 30, 90];

export default async function WastePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const sp = await searchParams;
  const days = RANGES.includes(Number(sp?.days)) ? Number(sp.days) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: ingRows }, { data: wasteRows }, { data: reportRows }, { data: bizRow }] =
    await Promise.all([
      supabase
        .from("ingredients")
        .select("id, name, unit, cost, stock_qty, track_stock")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("waste_events")
        .select("id, ingredient_id, quantity, reason, note, created_at, ingredient:ingredients(name, unit)")
        .eq("business_id", business.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.rpc("ingredient_usage_report", { p_business_id: business.id, p_since: since }),
      supabase.from("businesses").select("currency").eq("id", business.id).maybeSingle(),
    ]);

  const currency = ((bizRow?.currency as string) || "USD").toUpperCase();
  const ingById = new Map(
    (ingRows ?? []).map((i) => [
      i.id as string,
      { name: i.name as string, unit: (i.unit as string) || "unit", cost: Number(i.cost) || 0 },
    ])
  );

  const report = ((reportRows ?? []) as {
    ingredient_id: string;
    sales_qty: number;
    waste_qty: number;
  }[])
    .map((r) => {
      const ing = ingById.get(r.ingredient_id);
      const salesQty = Number(r.sales_qty) || 0;
      const wasteQty = Number(r.waste_qty) || 0;
      const cost = ing?.cost ?? 0;
      const usage = salesQty + wasteQty;
      return {
        ingredient_id: r.ingredient_id as string,
        name: ing?.name ?? "(removed ingredient)",
        unit: ing?.unit ?? "unit",
        sales_qty: salesQty,
        waste_qty: wasteQty,
        sales_cost: salesQty * cost,
        waste_cost: wasteQty * cost,
        waste_pct: usage > 0 ? wasteQty / usage : 0,
      };
    })
    .filter((r) => r.sales_qty > 0 || r.waste_qty > 0)
    .sort((a, b) => b.waste_cost - a.waste_cost);

  const totalWasteCost = report.reduce((s, r) => s + r.waste_cost, 0);
  const totalSalesCost = report.reduce((s, r) => s + r.sales_cost, 0);

  const ingredients = (ingRows ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    unit: (i.unit as string) || "unit",
    stock_qty: Number(i.stock_qty) || 0,
    track_stock: !!i.track_stock,
  }));

  const recent = (wasteRows ?? []).map((w) => {
    const ing = (w.ingredient as { name?: string; unit?: string } | null) ?? null;
    return {
      id: w.id as string,
      ingredient_id: w.ingredient_id as string,
      name: ing?.name ?? "(removed)",
      unit: ing?.unit ?? "unit",
      quantity: Number(w.quantity) || 0,
      reason: w.reason as string,
      note: (w.note as string | null) ?? null,
      created_at: w.created_at as string,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Waste &amp; variance</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Log ingredient waste and compare it against theoretical usage from sales.
        </p>
      </div>

      <WasteClient
        ingredients={ingredients}
        recent={recent}
        canManage={role === "owner" || role === "manager"}
      />

      <div className="bg-card border border-border rounded-lg p-6 mt-6 max-w-3xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium">Usage &amp; variance</h2>
          <div className="flex items-center gap-1 text-xs">
            {RANGES.map((d) => (
              <Link
                key={d}
                href={`/app/waste?days=${d}`}
                className={
                  "px-2 py-1 rounded-md border " +
                  (d === days ? "border-foreground bg-accent font-medium" : "border-border hover:bg-accent")
                }
              >
                {d}d
              </Link>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Theoretical usage = ingredients consumed by sales via recipes. Waste = logged loss.
        </p>

        {report.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No usage or waste in this period yet. Sell dishes with recipes and log waste to see variance.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <Stat label="Theoretical usage" value={fmt(totalSalesCost, currency)} />
              <Stat label="Waste" value={fmt(totalWasteCost, currency)} tone="warning" />
              <Stat
                label="Waste % of usage"
                value={
                  totalSalesCost + totalWasteCost > 0
                    ? Math.round((totalWasteCost / (totalSalesCost + totalWasteCost)) * 100) + "%"
                    : "0%"
                }
              />
            </div>
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide text-muted-foreground pb-1">
                <div className="col-span-4">Ingredient</div>
                <div className="col-span-3 text-right">Sales usage</div>
                <div className="col-span-3 text-right">Waste</div>
                <div className="col-span-2 text-right">Waste %</div>
              </div>
              {report.map((r) => (
                <div key={r.ingredient_id} className="grid grid-cols-12 gap-2 py-2 text-sm items-center">
                  <div className="col-span-4 truncate font-medium">{r.name}</div>
                  <div className="col-span-3 text-right tabular-nums text-muted-foreground">
                    {r.sales_qty} {r.unit} {"·"} {fmt(r.sales_cost, currency)}
                  </div>
                  <div className="col-span-3 text-right tabular-nums">
                    {r.waste_qty} {r.unit} {"·"} {fmt(r.waste_cost, currency)}
                  </div>
                  <div
                    className={
                      "col-span-2 text-right tabular-nums font-medium " +
                      (r.waste_pct >= 0.1 ? "text-red-600" : r.waste_pct >= 0.05 ? "text-amber-600" : "text-muted-foreground")
                    }
                  >
                    {Math.round(r.waste_pct * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fmt(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-lg font-semibold tabular-nums " + (tone === "warning" ? "text-amber-600" : "")}>
        {value}
      </div>
    </div>
  );
}
