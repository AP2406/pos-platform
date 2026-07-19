import type { SupabaseClient } from "@supabase/supabase-js";

// Move an item to another table — the money-independent half of TB's "transfer
// item" (P0-6). Appends one line to the destination table's open_ticket, creating
// the check if the table has none. NO kitchen ticket, NO tender. Fresh core (does
// not touch the money-adjacent pos/ticket-actions); unify after the live test.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export type AppendItem = { catalog_item_id: string | null; name: string; unit_price: number; quantity: number; note?: string | null; seat?: number | null };
export type AppendArgs = { businessId: string; staffId: string | null; elementId: string; label?: string | null; item: AppendItem };

export async function appendLineToTable(supabase: Sb, args: AppendArgs): Promise<{ ticketId: string } | { error: string }> {
  const qty = Number(args.item?.quantity) || 0;
  if (!args.elementId) return { error: "Pick a table." };
  if (qty <= 0) return { error: "Nothing to move." };

  const cartItem = {
    catalog_item_id: args.item.catalog_item_id ?? null,
    variation_id: null,
    name: String(args.item.name ?? "Item"),
    unit_price: Number(args.item.unit_price) || 0,
    quantity: qty,
    sent_qty: 0, // moved = unfired on the destination
    note: args.item.note ?? null,
    seat: args.item.seat ?? null,
    course_id: null,
  };

  const nowIso = new Date().toISOString();
  // One open check per table (parent-less). Append to it, or open a new one.
  const { data: existing } = await supabase
    .from("open_tickets")
    .select("id, cart, parent_ticket_id")
    .eq("business_id", args.businessId)
    .eq("element_id", args.elementId)
    .is("parent_ticket_id", null)
    .maybeSingle();

  if (existing) {
    if (existing.parent_ticket_id) return { error: "Can't move into a split check." };
    const cart = (existing.cart ?? {}) as { items?: unknown[] };
    const prev = Array.isArray(cart.items) ? cart.items : [];
    const { error } = await supabase
      .from("open_tickets")
      .update({ cart: { ...cart, items: [...prev, cartItem] }, updated_at: nowIso })
      .eq("id", existing.id)
      .eq("business_id", args.businessId);
    if (error) {
      console.error("appendLineToTable update:", error);
      return { error: "Could not move the item." };
    }
    return { ticketId: existing.id as string };
  }

  const { data: created, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: args.businessId,
      ticket_type: "table",
      label: args.label ?? "Table",
      element_id: args.elementId,
      cart: { items: [cartItem] },
      staff_id: args.staffId ?? null,
      opened_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("appendLineToTable open:", error);
    return { error: "Could not open the destination check." };
  }
  return { ticketId: created.id as string };
}
