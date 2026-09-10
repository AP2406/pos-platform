import type { SupabaseClient } from "@supabase/supabase-js";

// Fire an ingested delivery order to the Kitchen Display.
//
// A third-party (Deliverect/UberEats/…) order arrives PRE-PAID, so it is recorded
// as a completed `orders` row by inject_delivery_order — NOT an open check. What
// was missing is the kitchen half: without a kitchen_ticket the order never shows
// on the KDS. This creates it (station-split where we can match the item name to a
// catalog item), so a delivery order behaves like any fired ticket.
//
// Money-INDEPENDENT: no tender, no charge, no open_ticket.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export type DeliveryKitchenItem = { name: string; quantity: number; note?: string | null };
export type FireDeliveryArgs = {
  businessId: string;
  platform: string; // "deliverect" | "ubereats" | …
  displayId?: string | null; // channel-facing order number (#42)
  externalId: string;
  items: DeliveryKitchenItem[];
};

const PLATFORM_LABEL: Record<string, string> = {
  deliverect: "Deliverect",
  delivery: "Delivery",
  ubereats: "Uber Eats",
  doordash: "DoorDash",
  grubhub: "Grubhub",
};

// One card per delivery order on the KDS: the base label is shared across any
// station split, which is exactly how the KDS groups a table's tickets.
export function deliveryTicketLabel(platform: string, displayId?: string | null, externalId?: string): string {
  const p = PLATFORM_LABEL[(platform || "").toLowerCase()] ?? "Delivery";
  const num = (displayId && String(displayId).trim()) || (externalId ? "#" + String(externalId).slice(-6) : "");
  return num ? `${p} ${num}` : p;
}

export async function fireDeliveryOrderToKitchen(supabase: Sb, args: FireDeliveryArgs): Promise<{ fired: number; tickets: number } | { error: string }> {
  const items = (args.items ?? []).filter((i) => Number(i.quantity) > 0);
  if (items.length === 0) return { error: "No items to fire." };

  // Best-effort station routing: channel item names are free text, so match them
  // against the catalog by name. Unmatched items fall to the no-station ticket
  // (still visible on the KDS "All" tab).
  const names = Array.from(new Set(items.map((i) => (i.name || "").trim()).filter(Boolean)));
  const stationByName: Record<string, string | null> = {};
  const allergensByName: Record<string, string[]> = {};
  if (names.length) {
    const { data } = await supabase.from("catalog_items").select("name, station_id, allergens").eq("business_id", args.businessId).in("name", names);
    for (const c of data ?? []) {
      const n = String(c.name ?? "");
      stationByName[n] = (c.station_id as string | null) ?? null;
      const al = c.allergens;
      allergensByName[n] = Array.isArray(al) ? al.map((a: unknown) => String(a)) : [];
    }
  }

  const label = deliveryTicketLabel(args.platform, args.displayId, args.externalId);
  const groups = new Map<string | null, { name: string; quantity: number; note: string | null; allergens: string[] }[]>();
  for (const i of items) {
    const n = (i.name || "").trim();
    const station = stationByName[n] ?? null;
    const arr = groups.get(station) ?? [];
    arr.push({ name: n || "Item", quantity: Number(i.quantity) || 1, note: i.note ?? null, allergens: allergensByName[n] ?? [] });
    groups.set(station, arr);
  }

  const nowIso = new Date().toISOString();
  const rows = [...groups.entries()].map(([stationId, its]) => ({
    business_id: args.businessId,
    element_id: null, // delivery orders have no table
    label,
    items: its,
    station_id: stationId,
    created_by: null, // system-ingested
    fired_at: nowIso,
  }));

  const { error } = await supabase.from("kitchen_tickets").insert(rows);
  if (error) {
    console.error("fireDeliveryOrderToKitchen:", error);
    return { error: "Could not fire the delivery order to the kitchen." };
  }
  return { fired: items.reduce((s, i) => s + (Number(i.quantity) || 1), 0), tickets: rows.length };
}
