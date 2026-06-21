import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { KitchenClient } from "./kitchen-client";
import { listKitchenStations } from "./stations-actions";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  // B9: operator-configurable KDS aging thresholds (settings.kds), default 10/18.
  const kds = (((business as { settings?: Record<string, unknown> }).settings ?? {}).kds ?? {}) as { warnMin?: unknown; lateMin?: unknown };
  const kdsWarn = Number(kds.warnMin) > 0 ? Number(kds.warnMin) : 10;
  const kdsLate = Number(kds.lateMin) > kdsWarn ? Number(kds.lateMin) : Math.max(kdsWarn + 1, 18);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, customer_id, created_at, kds_prepared, rush")
    .eq("business_id", business.id)
    .eq("status", "paid")
    .is("fulfilled_at", null)
    .order("created_at", { ascending: true });

  const orderRows = orders ?? [];
  const ids = orderRows.map((o) => o.id as string);

  // Set of prepared order_item ids per order (online/takeout per-item bump). Must
  // match the client refresh() so online lines are tappable on the FIRST paint.
  const preparedByOrder: Record<string, Set<string>> = {};
  for (const o of orderRows) {
    const arr = Array.isArray(o.kds_prepared) ? (o.kds_prepared as string[]) : [];
    preparedByOrder[o.id as string] = new Set(arr);
  }

  const itemsByOrder: Record<string, { id: string; name: string; quantity: number; ready: boolean }[]> = {};
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("id, order_id, name, quantity")
      .in("order_id", ids);
    for (const it of items ?? []) {
      const oid = it.order_id as string;
      const iid = it.id as string;
      if (!itemsByOrder[oid]) itemsByOrder[oid] = [];
      itemsByOrder[oid].push({
        id: iid,
        name: it.name as string,
        quantity: Number(it.quantity),
        ready: preparedByOrder[oid]?.has(iid) ?? false,
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
    rush: (o.rush as boolean | null) ?? false,
    items: itemsByOrder[o.id as string] ?? [],
  }));

  // Fired-but-unpaid table tickets (full service). Kept separate from orders so
  // they never count as revenue; the KDS shows both.
  const { data: kts } = await supabase
    .from("kitchen_tickets")
    .select("id, label, items, fired_at, station_id, element_id, rush")
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
      rush: (k.rush as boolean | null) ?? false,
      items: Array.isArray(k.items)
        ? (k.items as { name: string; quantity: number; note?: string | null; seat?: number | null; allergens?: string[] | null; allergy?: string | null; prep_minutes?: number | null; void?: boolean }[])
        : [],
    };
  });

  const initialOrders = [...orderCards, ...kitchenCards].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );

  // Recently bumped (last 30 min) — feeds the Recall strip so a too-soon bump
  // can be restored to the active board in its exact prior state.
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentKts } = await supabase
    .from("kitchen_tickets")
    .select("id, label, element_id, fulfilled_at")
    .eq("business_id", business.id)
    .not("fulfilled_at", "is", null)
    .gte("fulfilled_at", since)
    .order("fulfilled_at", { ascending: false })
    .limit(20);
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, customer_id, fulfilled_at")
    .eq("business_id", business.id)
    .eq("status", "paid")
    .not("fulfilled_at", "is", null)
    .gte("fulfilled_at", since)
    .order("fulfilled_at", { ascending: false })
    .limit(20);

  const recent = [
    ...(recentKts ?? []).map((k) => ({
      id: k.id as string,
      kind: "kitchen" as const,
      label:
        (k.element_id ? elementLabelById[k.element_id as string] : null) ??
        (k.label as string | null) ??
        "Ticket",
      fulfilledAt: k.fulfilled_at as string,
    })),
    ...(recentOrders ?? []).map((o) => ({
      id: o.id as string,
      kind: "order" as const,
      label:
        (o.customer_id ? customerNames[o.customer_id as string] : null) ??
        "#" + (o.id as string).slice(0, 6),
      fulfilledAt: o.fulfilled_at as string,
    })),
  ]
    .sort((a, b) => (a.fulfilledAt < b.fulfilledAt ? 1 : -1))
    .slice(0, 12);

  // Menu for the KDS-side 86 board (chef/expo can 86/un-86 during service).
  const { data: menuRows } = await supabase
    .from("catalog_items")
    .select("id, name, category, out_of_stock")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name", { ascending: true });
  const menu = (menuRows ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    category: (m.category as string | null) ?? null,
    out_of_stock: (m.out_of_stock as boolean | null) ?? false,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Kitchen</h1>
        <p className="text-muted-foreground text-sm mt-1">
          New orders appear here automatically. Tap Done when an order is ready.
        </p>
      </div>
      <KitchenClient businessId={business.id} initialOrders={initialOrders} stations={stations} recent={recent} menu={menu} kdsWarn={kdsWarn} kdsLate={kdsLate} />
    </div>
  );
}