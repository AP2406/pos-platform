import type { SupabaseClient } from "@supabase/supabase-js";

// Fire the cart to the kitchen — money-independent half of the order lifecycle.
// Upserts an open_ticket (the check) and inserts station-split kitchen_tickets.
// NO orders row, NO tender, NO Finix. Fresh implementation (does not touch the
// money-adjacent pos/ticket-actions); unify with that path after the live test.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export type FireItem = { catalog_item_id: string | null; name: string; unit_price: number; quantity: number; note?: string | null; seat?: number | null; allergy?: string | null };
export type FireArgs = {
  businessId: string;
  staffId: string | null;
  createdBy: string | null;
  ticketId?: string | null;
  elementId?: string | null;
  label?: string | null;
  ticketType?: string | null;
  channel?: string | null;
  guestCount?: number | null;
  items: FireItem[];
};

export async function fireToKitchen(supabase: Sb, args: FireArgs): Promise<{ ticketId: string; fired: number } | { error: string }> {
  const items = (args.items ?? []).filter((i) => Number(i.quantity) > 0);
  if (items.length === 0) return { error: "Nothing to send." };

  // Station + kitchen metadata for the fired items (money-independent lookup).
  const catIds = Array.from(new Set(items.map((i) => i.catalog_item_id).filter((x): x is string => !!x)));
  const stationByItem: Record<string, string | null> = {};
  const allergensByItem: Record<string, string[]> = {};
  const outOfStock = new Set<string>();
  if (catIds.length) {
    const { data } = await supabase.from("catalog_items").select("id, station_id, out_of_stock, allergens").eq("business_id", args.businessId).in("id", catIds);
    for (const c of data ?? []) {
      stationByItem[c.id as string] = (c.station_id as string | null) ?? null;
      if ((c.out_of_stock as boolean | null) === true) outOfStock.add(c.id as string);
      const al = c.allergens;
      allergensByItem[c.id as string] = Array.isArray(al) ? al.map((a: unknown) => String(a)) : [];
    }
  }

  // Kitchen safety: don't fire 86'd items.
  const fireable = items.filter((i) => !(i.catalog_item_id && outOfStock.has(i.catalog_item_id)));
  if (fireable.length === 0) return { error: "Those items are 86'd." };

  const nowIso = new Date().toISOString();
  const label = args.label ?? "Ticket";

  // 1) Upsert the open check (cart carries sent_qty so staff don't re-fire).
  const cartItems = fireable.map((i) => ({
    catalog_item_id: i.catalog_item_id ?? null,
    variation_id: null,
    name: i.name,
    unit_price: Number(i.unit_price) || 0,
    quantity: Number(i.quantity) || 1,
    sent_qty: Number(i.quantity) || 1,
    note: i.note ?? null,
    seat: i.seat ?? null,
    course_id: null,
  }));

  let ticketId = args.ticketId ?? null;
  if (ticketId) {
    const { data: existing } = await supabase.from("open_tickets").select("cart").eq("id", ticketId).eq("business_id", args.businessId).maybeSingle();
    const cart = (existing?.cart ?? {}) as { items?: unknown[] };
    const prev = Array.isArray(cart.items) ? cart.items : [];
    const { error } = await supabase.from("open_tickets").update({ cart: { ...cart, items: [...prev, ...cartItems] }, updated_at: nowIso }).eq("id", ticketId).eq("business_id", args.businessId);
    if (error) {
      console.error("fireToKitchen update:", error);
      return { error: "Could not update the check." };
    }
  } else {
    const { data: created, error } = await supabase
      .from("open_tickets")
      .insert({
        business_id: args.businessId,
        ticket_type: args.ticketType ?? (args.elementId ? "table" : "togo"),
        label,
        element_id: args.elementId ?? null,
        guest_count: args.guestCount ?? null,
        cart: { items: cartItems },
        channel: args.channel ?? null,
        staff_id: args.staffId ?? null,
        opened_at: nowIso,
        updated_at: nowIso,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("fireToKitchen open:", error);
      return { error: "Could not open the check." };
    }
    ticketId = created.id as string;
  }

  // 2) Station-split → one kitchen_ticket per prep station.
  const groups = new Map<string | null, { name: string; quantity: number; note: string | null; allergens: string[] }[]>();
  for (const i of fireable) {
    const st = i.catalog_item_id ? stationByItem[i.catalog_item_id] ?? null : null;
    const arr = groups.get(st) ?? [];
    // The item's inherent allergens, plus any per-line guest allergy alert so the
    // KDS flags it red alongside the dish.
    const inherent = i.catalog_item_id ? allergensByItem[i.catalog_item_id] ?? [] : [];
    const guest = (i.allergy ?? "").trim();
    const allergens = guest ? [...inherent, ...guest.split(",").map((a) => a.trim()).filter(Boolean)] : inherent;
    arr.push({ name: i.name, quantity: Number(i.quantity) || 1, note: i.note ?? null, allergens });
    groups.set(st, arr);
  }
  const rows = [...groups.entries()].map(([stationId, its]) => ({
    business_id: args.businessId,
    element_id: args.elementId ?? null,
    label,
    items: its,
    station_id: stationId,
    created_by: args.createdBy,
    fired_at: nowIso,
  }));
  const { error: fireErr } = await supabase.from("kitchen_tickets").insert(rows);
  if (fireErr) {
    console.error("fireToKitchen fire:", fireErr);
    return { error: "Saved the check, but firing to the kitchen failed." };
  }

  return { ticketId, fired: fireable.reduce((s, i) => s + (Number(i.quantity) || 1), 0) };
}
