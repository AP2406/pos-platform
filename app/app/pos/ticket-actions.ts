"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { getActiveStaff } from "./staff-session";
import { z } from "zod";

const cartLineSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  variation_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
});

const customerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(120),
});

const cartSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Nothing to hold."),
  tip: z.string().max(20).optional(),
  discount_mode: z.enum(["amount", "percent"]).optional(),
  discount_value: z.string().max(20).optional(),
  discount_reason: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  customer: customerSchema.nullable().optional(),
});

type CartInput = z.infer<typeof cartSchema>;

export type OpenTicketSummary = {
  id: string;
  label: string | null;
  item_count: number;
  subtotal: number;
  created_at: string;
  cart: CartInput;
};

export async function holdTicket(input: {
  label?: string | null;
  cart: CartInput;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = cartSchema.safeParse(input.cart);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nothing to hold." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const label =
    input.label && input.label.trim() ? input.label.trim().slice(0, 80) : null;

  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      label: label,
      cart: parsed.data,
      created_by: user ? user.id : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("holdTicket:", error);
    return { error: "Could not hold the ticket. Please try again." };
  }

  return { ok: true, id: data.id as string };
}

export async function listOpenTickets(): Promise<OpenTicketSummary[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, cart, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("listOpenTickets:", error);
    return [];
  }

  return (data ?? []).map((t) => {
    const cart = (t.cart as CartInput) || { items: [] };
    const items = Array.isArray(cart.items) ? cart.items : [];
    let itemCount = 0;
    let subtotal = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      itemCount += qty;
      subtotal += (Number(it.unit_price) || 0) * qty;
    }
    return {
      id: t.id as string,
      label: (t.label as string | null) ?? null,
      item_count: itemCount,
      subtotal: Math.round(subtotal * 100) / 100,
      created_at: t.created_at as string,
      cart: cart,
    };
  });
}

export async function resumeTicket(
  ticketId: string
): Promise<{ ok: true; cart: CartInput } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, cart")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!ticket) return { error: "That ticket is no longer open." };

  const { error: delError } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (delError) {
    console.error("resumeTicket delete:", delError);
    return { error: "Could not resume the ticket. Please try again." };
  }

  return { ok: true, cart: (ticket.cart as CartInput) || { items: [] } };
}

export async function discardTicket(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("business_id", business.id);

  if (error) {
    console.error("discardTicket:", error);
    return { error: "Could not discard the ticket. Please try again." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Table-bound tickets (full-service floor). These are the SAME open_tickets
// rows, but a table ticket carries a table_id and a persistent lifecycle:
// loaded WITHOUT deleting (the table stays occupied), re-saved as items change,
// and only removed when the table is paid out or voided. Non-table tickets
// (table_id = null) keep their exact current hold/resume behavior above.
// ---------------------------------------------------------------------------

// A table cart may be empty (a just-opened table) and each line carries a
// sent_qty so "Send to kitchen" only fires not-yet-sent items.
const tableCartLineSchema = cartLineSchema.extend({
  sent_qty: z.coerce.number().int().min(0).max(1000).optional(),
  note: z.string().max(280).optional().nullable(),
  // Seat this line belongs to (1-based); null/absent = shared / no seat.
  seat: z.coerce.number().int().min(1).max(99).optional().nullable(),
});
const tableCartSchema = z.object({
  items: z.array(tableCartLineSchema).max(200),
  tip: z.string().max(20).optional(),
  discount_mode: z.enum(["amount", "percent"]).optional(),
  discount_value: z.string().max(20).optional(),
  discount_reason: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  customer: customerSchema.nullable().optional(),
});
export type TableCart = z.infer<typeof tableCartSchema>;

export type TableTicketSummary = {
  id: string;
  element_id: string;
  guest_count: number | null;
  opened_at: string;
  item_count: number;
  subtotal: number;
  staff_id: string | null;
  server_name: string | null;
};

export type TogoTicketSummary = {
  id: string;
  name: string | null;
  phone: string | null;
  opened_at: string;
  item_count: number;
  subtotal: number;
  staff_id: string | null;
  server_name: string | null;
};

// Open a table: create its persistent ticket. If the table already has an open
// ticket (unique index race), return that one instead of erroring.
export async function openTableTicket(
  elementId: string,
  guestCount?: number | null
): Promise<{ ok: true; ticketId: string; cart: TableCart } | { error: string }> {
  if (!elementId) return { error: "Missing table." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const guests =
    guestCount && Number.isFinite(guestCount) && guestCount > 0
      ? Math.min(Math.round(guestCount), 999)
      : null;

  const active = await getActiveStaff();
  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      element_id: elementId,
      ticket_type: "table",
      guest_count: guests,
      staff_id: active ? active.id : null,
      cart: { items: [] },
      created_by: user ? user.id : null,
    })
    .select("id, cart")
    .single();

  if (error) {
    // 23505 = the one-open-ticket-per-element unique index. Load the existing one.
    if ((error as { code?: string }).code === "23505") {
      const { data: existing } = await supabase
        .from("open_tickets")
        .select("id, cart")
        .eq("business_id", business.id)
        .eq("element_id", elementId)
        .maybeSingle();
      if (existing) {
        return {
          ok: true,
          ticketId: existing.id as string,
          cart: (existing.cart as TableCart) || { items: [] },
        };
      }
    }
    console.error("openTableTicket:", error);
    return { error: "Could not open the table. Please try again." };
  }

  return {
    ok: true,
    ticketId: data.id as string,
    cart: (data.cart as TableCart) || { items: [] },
  };
}

// Load a table ticket WITHOUT deleting it (the table stays occupied).
export async function loadTableTicket(
  ticketId: string
): Promise<
  | { ok: true; cart: TableCart; elementId: string | null; guestCount: number | null }
  | { error: string }
> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, cart, element_id, guest_count")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (error || !data) return { error: "That table is no longer open." };

  return {
    ok: true,
    cart: (data.cart as TableCart) || { items: [] },
    elementId: (data.element_id as string | null) ?? null,
    guestCount: (data.guest_count as number | null) ?? null,
  };
}

// Re-save a table ticket's cart as items are added/removed (autosave).
export async function updateTableTicket(
  ticketId: string,
  cart: TableCart
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const parsed = tableCartSchema.safeParse(cart);
  if (!parsed.success) return { error: "Could not save the table." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("open_tickets")
    .update({ cart: parsed.data })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateTableTicket:", error);
    return { error: "Could not save the table." };
  }
  return { ok: true };
}

// Close a table: remove its open ticket AND clear that table's open kitchen
// tickets, so a paid-out or voided table never haunts the kitchen screen.
export async function closeTableTicket(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, element_id")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();

  const elementId = ticket ? ((ticket.element_id as string | null) ?? null) : null;
  if (elementId) {
    await supabase
      .from("kitchen_tickets")
      .update({ fulfilled_at: new Date().toISOString() })
      .eq("business_id", business.id)
      .eq("element_id", elementId)
      .is("fulfilled_at", null);
  }

  const { error } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("closeTableTicket:", error);
    return { error: "Could not close the table." };
  }
  return { ok: true };
}

// Fire the not-yet-sent items of a table ticket to the kitchen. Creates a
// kitchen_tickets row (NOT a paid order, so reporting is untouched) and bumps
// each line's sent_qty so re-firing only sends new items. Returns the count
// fired so the register can mark those lines as sent.
export async function sendTableTicket(
  ticketId: string,
  cart: TableCart
): Promise<{ ok: true; fired: number } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const parsed = tableCartSchema.safeParse(cart);
  if (!parsed.success) return { error: "Could not read the table." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, element_id, label")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!ticket) return { error: "That ticket is no longer open." };
  const elementId = (ticket.element_id as string | null) ?? null;

  // Kitchen ticket label: the table's name, or the ticket's own label (to-go).
  let label: string | null = (ticket.label as string | null) ?? null;
  if (elementId) {
    const { data: el } = await supabase
      .from("floor_elements")
      .select("label")
      .eq("id", elementId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (el && el.label) label = el.label as string;
  }

  // Items to fire = quantity beyond what was already sent.
  const fired: { name: string; quantity: number; note?: string | null; seat?: number | null }[] = [];
  const updatedItems = parsed.data.items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const sent = Number(it.sent_qty) || 0;
    const delta = qty - sent;
    if (delta > 0) fired.push({ name: it.name, quantity: delta, note: it.note ?? null, seat: it.seat ?? null });
    return { ...it, sent_qty: qty };
  });

  if (fired.length === 0) {
    // Nothing new — still persist any pending cart edits, then no-op.
    await supabase
      .from("open_tickets")
      .update({ cart: { ...parsed.data, items: updatedItems } })
      .eq("id", ticketId)
      .eq("business_id", business.id);
    return { ok: true, fired: 0 };
  }

  const { error: insErr } = await supabase.from("kitchen_tickets").insert({
    business_id: business.id,
    element_id: elementId,
    label: label,
    items: fired,
    created_by: user ? user.id : null,
  });
  if (insErr) {
    console.error("sendTableTicket insert:", insErr);
    return { error: "Could not send to the kitchen. Please try again." };
  }

  const { error: updErr } = await supabase
    .from("open_tickets")
    .update({ cart: { ...parsed.data, items: updatedItems } })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (updErr) {
    console.error("sendTableTicket update:", updErr);
    // The fire succeeded; the client will still mark items sent locally.
  }

  return { ok: true, fired: fired.reduce((s, f) => s + f.quantity, 0) };
}

function cartTotals(cartRaw: unknown): { item_count: number; subtotal: number } {
  const cart = (cartRaw as TableCart) || { items: [] };
  const items = Array.isArray(cart.items) ? cart.items : [];
  let itemCount = 0;
  let subtotal = 0;
  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    itemCount += qty;
    subtotal += (Number(it.unit_price) || 0) * qty;
  }
  return { item_count: itemCount, subtotal: Math.round(subtotal * 100) / 100 };
}

// Resolve staff ids -> display names in one query.
async function serverNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  ids: (string | null)[]
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from("staff_members")
    .select("id, name")
    .eq("business_id", businessId)
    .in("id", unique);
  const map: Record<string, string> = {};
  for (const s of data ?? []) map[s.id as string] = s.name as string;
  return map;
}

// Summaries of all currently-open tables for the floor view.
export async function listOpenTableTickets(): Promise<TableTicketSummary[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, element_id, guest_count, opened_at, cart, staff_id")
    .eq("business_id", business.id)
    .not("element_id", "is", null);
  if (error) {
    console.error("listOpenTableTickets:", error);
    return [];
  }

  const names = await serverNames(supabase, business.id, (data ?? []).map((t) => (t.staff_id as string | null) ?? null));
  return (data ?? []).map((t) => {
    const totals = cartTotals(t.cart);
    const staffId = (t.staff_id as string | null) ?? null;
    return {
      id: t.id as string,
      element_id: t.element_id as string,
      guest_count: (t.guest_count as number | null) ?? null,
      opened_at: t.opened_at as string,
      item_count: totals.item_count,
      subtotal: totals.subtotal,
      staff_id: staffId,
      server_name: staffId ? names[staffId] ?? null : null,
    };
  });
}

// Open a takeout ticket — a check with no table. Name + phone are required so
// staff can call the customer when it's ready.
export async function openTogoTicket(
  name?: string | null,
  phone?: string | null
): Promise<{ ok: true; ticketId: string; name: string | null } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const active = await getActiveStaff();

  const label = name && name.trim() ? name.trim().slice(0, 80) : null;
  const tel = phone && phone.trim() ? phone.trim().slice(0, 40) : null;
  if (!label) return { error: "Enter the customer's name." };
  if (!tel) return { error: "Enter the customer's phone number." };

  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      ticket_type: "togo",
      label: label,
      customer_phone: tel,
      staff_id: active ? active.id : null,
      cart: { items: [] },
      created_by: user ? user.id : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("openTogoTicket:", error);
    return { error: "Could not start the takeout order. Please try again." };
  }
  return { ok: true, ticketId: data.id as string, name: label };
}

// Summaries of all currently-open to-go tickets for the floor rail.
export async function listOpenTogoTickets(): Promise<TogoTicketSummary[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, customer_phone, opened_at, cart, staff_id")
    .eq("business_id", business.id)
    .eq("ticket_type", "togo");
  if (error) {
    console.error("listOpenTogoTickets:", error);
    return [];
  }

  const names = await serverNames(supabase, business.id, (data ?? []).map((t) => (t.staff_id as string | null) ?? null));
  return (data ?? []).map((t) => {
    const totals = cartTotals(t.cart);
    const staffId = (t.staff_id as string | null) ?? null;
    return {
      id: t.id as string,
      name: (t.label as string | null) ?? null,
      phone: (t.customer_phone as string | null) ?? null,
      opened_at: t.opened_at as string,
      item_count: totals.item_count,
      subtotal: totals.subtotal,
      staff_id: staffId,
      server_name: staffId ? names[staffId] ?? null : null,
    };
  });
}

// Reassign the server on an open ticket (table or to-go).
export async function setTicketServer(
  ticketId: string,
  staffId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("open_tickets")
    .update({ staff_id: staffId })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setTicketServer:", error);
    return { error: "Could not change the server." };
  }
  return { ok: true };
}