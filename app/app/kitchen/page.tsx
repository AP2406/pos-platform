import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { KitchenClient } from "./kitchen-client";
import { listKitchenStations } from "./stations-actions";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, customer_id, created_at")
    .eq("business_id", business.id)
    .eq("status", "paid")
    .is("fulfilled_at", null)
    .order("created_at", { ascending: true });

  const orderRows = orders ?? [];
  const ids = orderRows.map((o) => o.id as string);

  const itemsByOrder: Record<string, { name: string; quantity: number }[]> = {};
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, name, quantity")
      .in("order_id", ids);
    for (const it of items ?? []) {
      const oid = it.order_id as string;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push({
        name: it.name as string,
        quantity: Number(it.quantity),
      });
    }
  }

  const customerNames: Record<string, string> = {};
  const custIds = orderRows
    .map((o) => o.customer_id as string | null)
    .filter((x): x is string => !!x);
  if (custIds.length > 0) {
    const { data: custs } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", custIds);
    for (const c of custs ?? []) {
      customerNames[c.id as string] = c.name as string;
    }
  }

  const orderCards = orderRows.map((o) => ({
    id: o.id as string,
    kind: "order" as const,
    createdAt: (o.created_at as string) ?? new Date().toISOString(),
    customerName: o.customer_id
      ? customerNames[o.customer_id as string] ?? null
      : null,
    tableLabel: null as string | null,
    stationId: null as string | null,
    stationName: null as string | null,
    elementId: null as string | null,
    tableName: null as string | null,
    items: itemsByOrder[o.id as string] ?? [],
  }));

  // Fired-but-unpaid table tickets (full service). Kept separate from orders so
  // they never count as revenue; the KDS shows both.
  const { data: kts } = await supabase
    .from("kitchen_tickets")
    .select("id, label, items, fired_at, station_id, element_id")
    .eq("business_id", business.id)
    .is("fulfilled_at", null)
    .order("fired_at", { ascending: true });

  const stations = await listKitchenStations();
  const stationNameById: Record<string, string> = {};
  for (const s of stations) stationNameById[s.id] = s.name;

  // Clean table names for the expo view, which groups a table's station/course
  // tickets back into one card.
  const elementIds = Array.from(
    new Set((kts ?? []).map((k) => k.element_id as string | null).filter((x): x is string => !!x))
  );
  const elementLabelById: Record<string, string> = {};
  if (elementIds.length > 0) {
    const { data: els } = await supabase
      .from("floor_elements")
      .select("id, label")
      .in("id", elementIds);
    for (const e of els ?? []) elementLabelById[e.id as string] = (e.label as string | null) ?? "Table";
  }

  const kitchenCards = (kts ?? []).map((k) => {
    const elementId = (k.element_id as string | null) ?? null;
    const stationId = (k.station_id as string | null) ?? null;
    return {
      id: k.id as string,
      kind: "kitchen" as const,
      createdAt: (k.fired_at as string) ?? new Date().toISOString(),
      customerName: null as string | null,
      tableLabel: (k.label as string | null) ?? null,
      stationId,
      stationName: stationId ? stationNameById[stationId] ?? null : null,
      elementId,
      tableName: elementId ? elementLabelById[elementId] ?? "Table" : (k.label as string | null) ?? "Ticket",
      items: Array.isArray(k.items)
        ? (k.items as { name: string; quantity: number; note?: string | null }[])
        : [],
    };
  });

  const initialOrders = [...orderCards, ...kitchenCards].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Kitchen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          New orders appear here automatically. Tap Done when an order is ready.
        </p>
      </div>
      <KitchenClient businessId={business.id} initialOrders={initialOrders} stations={stations} />
    </div>
  );
}