import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { PurchasingClient } from "./purchasing-client";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export default async function PurchasingPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const [
    { data: vendorRows },
    { data: poRows },
    { data: lineRows },
    { data: ingRows },
    { data: itemRows },
    { data: bizRow },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, email, phone, notes, is_active")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("id, vendor_id, po_number, status, notes, expected_at, sent_at, received_at, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("po_lines")
      .select("id, po_id, ingredient_id, catalog_item_id, description, unit, quantity, unit_cost, received_qty")
      .eq("business_id", business.id),
    supabase
      .from("ingredients")
      .select("id, name, unit, cost, track_stock, stock_qty, reorder_point")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("catalog_items")
      .select("id, name, track_inventory, stock_qty, reorder_point")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("businesses").select("currency").eq("id", business.id).maybeSingle(),
  ]);

  const vendors = (vendorRows ?? []).map((v) => ({
    id: v.id as string,
    name: v.name as string,
    email: (v.email as string | null) ?? null,
    phone: (v.phone as string | null) ?? null,
    notes: (v.notes as string | null) ?? null,
    is_active: v.is_active as boolean,
  }));

  const linesByPo: Record<string, {
    id: string;
    ingredient_id: string | null;
    catalog_item_id: string | null;
    description: string;
    unit: string;
    quantity: number;
    unit_cost: number;
    received_qty: number;
  }[]> = {};
  for (const l of lineRows ?? []) {
    (linesByPo[l.po_id as string] ||= []).push({
      id: l.id as string,
      ingredient_id: (l.ingredient_id as string | null) ?? null,
      catalog_item_id: (l.catalog_item_id as string | null) ?? null,
      description: l.description as string,
      unit: (l.unit as string) || "unit",
      quantity: Number(l.quantity) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      received_qty: Number(l.received_qty) || 0,
    });
  }

  const orders = (poRows ?? []).map((p) => ({
    id: p.id as string,
    vendor_id: (p.vendor_id as string | null) ?? null,
    po_number: Number(p.po_number) || 0,
    status: p.status as string,
    notes: (p.notes as string | null) ?? null,
    expected_at: (p.expected_at as string | null) ?? null,
    sent_at: (p.sent_at as string | null) ?? null,
    received_at: (p.received_at as string | null) ?? null,
    lines: linesByPo[p.id as string] ?? [],
  }));

  const ingredients = (ingRows ?? []).map((i) => ({
    id: i.id as string,
    name: i.name as string,
    unit: (i.unit as string) || "unit",
    cost: Number(i.cost) || 0,
  }));
  const items = (itemRows ?? []).map((i) => ({ id: i.id as string, name: i.name as string }));
  const currency = ((bizRow?.currency as string) || "USD").toUpperCase();

  // Suggested ordering: tracked ingredients/items at or below their reorder point.
  // Suggested qty brings stock back up to the reorder point (min 1).
  const suggestions = [
    ...(ingRows ?? [])
      .filter((i) => i.track_stock && Number(i.stock_qty) <= Number(i.reorder_point))
      .map((i) => ({
        ingredient_id: i.id as string,
        catalog_item_id: null as string | null,
        description: i.name as string,
        unit: (i.unit as string) || "unit",
        unit_cost: Number(i.cost) || 0,
        suggested_qty: Math.max(
          1,
          Math.round((Number(i.reorder_point) - Number(i.stock_qty)) * 100) / 100
        ),
        on_hand: Number(i.stock_qty) || 0,
      })),
    ...(itemRows ?? [])
      .filter((i) => i.track_inventory && Number(i.stock_qty) <= Number(i.reorder_point))
      .map((i) => ({
        ingredient_id: null as string | null,
        catalog_item_id: i.id as string,
        description: i.name as string,
        unit: "unit",
        unit_cost: 0,
        suggested_qty: Math.max(1, Math.round(Number(i.reorder_point) - Number(i.stock_qty))),
        on_hand: Number(i.stock_qty) || 0,
      })),
  ];

  // C4: per-vendor price history + cost-creep, derived from the lines of POs that
  // were actually placed (sent/received carry the agreed price). Grouped by
  // vendor + item; we compare the latest unit cost to the prior one.
  const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(r2(n));
  const poMeta = new Map(
    (poRows ?? []).map((p) => [
      p.id as string,
      { vendor_id: (p.vendor_id as string | null) ?? null, status: p.status as string, date: (p.received_at as string | null) || (p.sent_at as string | null) || (p.created_at as string) },
    ])
  );
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const series = new Map<string, { vendor: string; item: string; unit: string; points: { date: string; cost: number }[] }>();
  for (const l of lineRows ?? []) {
    const m = poMeta.get(l.po_id as string);
    if (!m || (m.status !== "sent" && m.status !== "received")) continue;
    const cost = Number(l.unit_cost) || 0;
    if (cost <= 0) continue;
    const desc = (l.description as string) || "Item";
    const key = (m.vendor_id ?? "none") + "|" + ((l.ingredient_id as string | null) ?? "d:" + desc.toLowerCase().trim());
    const s = series.get(key) ?? { vendor: (m.vendor_id && vendorName.get(m.vendor_id)) || "No vendor", item: desc, unit: (l.unit as string) || "unit", points: [] };
    s.points.push({ date: m.date, cost });
    series.set(key, s);
  }
  const priceRows = Array.from(series.values()).map((s) => {
    s.points.sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = s.points[s.points.length - 1];
    const prev = s.points.length > 1 ? s.points[s.points.length - 2] : null;
    const change = prev && prev.cost > 0 ? (last.cost - prev.cost) / prev.cost : null;
    return { vendor: s.vendor, item: s.item, unit: s.unit, last: last.cost, prev: prev?.cost ?? null, change, n: s.points.length, lastDate: last.date };
  });
  const creep = priceRows.filter((r) => r.change != null && r.change > 0.1).sort((a, b) => (b.change ?? 0) - (a.change ?? 0));
  const trendTop = priceRows.filter((r) => r.n >= 2).sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1)).slice(0, 12);
  const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Purchasing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage vendors and raise purchase orders. Email a PO to a vendor, then
            receive stock against it.
          </p>
        </div>
        <Link href="/app/purchasing/invoices" className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent">
          Invoices
        </Link>
      </div>

      {creep.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6">
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-500 mb-2">⚠ Cost creep — {creep.length} item{creep.length === 1 ? "" : "s"} up &gt;10%</div>
          <div className="space-y-1 text-sm">
            {creep.slice(0, 6).map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="truncate">{r.item} <span className="text-xs text-muted-foreground">· {r.vendor}</span></span>
                <span className="tabular-nums shrink-0">
                  {fmtMoney(r.prev ?? 0)} → <span className="font-medium">{fmtMoney(r.last)}</span>
                  <span className="text-red-600 ml-1">+{Math.round((r.change ?? 0) * 100)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trendTop.length > 0 && (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden mb-6">
          <div className="px-3 py-2 border-b border-border text-sm font-semibold">Vendor price history</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium text-right">Prev</th>
                <th className="px-3 py-2 font-medium text-right">Latest</th>
                <th className="px-3 py-2 font-medium text-right">Change</th>
                <th className="px-3 py-2 font-medium text-right">As of</th>
              </tr>
            </thead>
            <tbody>
              {trendTop.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium truncate max-w-[200px]">{r.item}<span className="block text-[11px] text-muted-foreground font-normal">{r.n} orders · per {r.unit}</span></td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">{r.vendor}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.prev != null ? fmtMoney(r.prev) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(r.last)}</td>
                  <td className={"px-3 py-2 text-right tabular-nums " + (r.change == null ? "" : r.change > 0.001 ? "text-red-600" : r.change < -0.001 ? "text-emerald-600" : "")}>
                    {r.change == null ? "—" : (r.change > 0 ? "+" : "") + Math.round(r.change * 100) + "%"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtDate(r.lastDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PurchasingClient
        vendors={vendors}
        orders={orders}
        ingredients={ingredients}
        items={items}
        suggestions={suggestions}
        currency={currency}
        canManage={role === "owner" || role === "manager"}
      />
    </div>
  );
}
