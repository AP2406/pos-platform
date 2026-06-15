import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { PurchasingClient } from "./purchasing-client";

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Purchasing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage vendors and raise purchase orders. Email a PO to a vendor, then
          receive stock against it.
        </p>
      </div>
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
