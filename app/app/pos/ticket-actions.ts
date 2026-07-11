"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { getActiveStaff } from "./staff-session";
import { verifyManagerPin } from "./approval-actions";
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
  // Per-line/per-seat allergy tag (P3) — surfaced bold red on the KDS + chit.
  allergy: z.string().max(120).optional().nullable(),
  // Seat this line belongs to (1-based); null/absent = shared / no seat.
  seat: z.coerce.number().int().min(1).max(99).optional().nullable(),
  // E3: seats sharing this line — the by-seat split allocates it across just these.
  shared_seats: z.array(z.coerce.number().int().min(1).max(99)).max(99).optional().nullable(),
  // Coursing (P0-1, full-service): which course this line fires with, and when
  // it was last fired. Kitchen routing only — never affects totals.
  course_id: z.string().uuid().optional().nullable(),
  fired_at: z.string().max(40).optional().nullable(),
  // P0-10: voided line (kept for the record, excluded from charge).
  void: z.object({ reason_code: z.string().max(60).optional(), reason_note: z.string().max(500).optional() }).nullable().optional(),
  // P2-27: added by a guest via QR ordering (vs. rung in by staff).
  guest: z.boolean().optional(),
});
const tableCartSchema = z.object({
  items: z.array(tableCartLineSchema).max(200),
  tip: z.string().max(20).optional(),
  discount_mode: z.enum(["amount", "percent"]).optional(),
  discount_value: z.string().max(20).optional(),
  discount_reason: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  customer: customerSchema.nullable().optional(),
  // P3: optional guest name per seat — { "1": "John", "2": "Maya" }.
  seat_names: z.record(z.string(), z.string().max(40)).optional(),
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
  // P0-4: when this table has been split, how many child checks are still unpaid.
  split_kind: string | null;
  child_count: number;
  // P2-27: a guest added items via QR that haven't been fired yet.
  new_guest_items: boolean;
  // Phase A live state: any item fired to the kitchen, and whether the check was dropped.
  fired: boolean;
  check_dropped_at: string | null;
  // Searchable guest names (check customer + per-seat names) for find-my-check.
  guests: string;
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

// P1-20: a bar tab is a table-less open check identified by a name — no phone
// required (unlike to-go). It reuses the whole table cart / fire / pay pipeline.
export type BarTabSummary = {
  id: string;
  name: string | null;
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
  // A2: a new check auto-attributes to the server assigned to this table's section
  // today (if any); otherwise the active cashier. Managers can still reassign.
  let attributedStaffId: string | null = active ? active.id : null;
  {
    const { data: el } = await supabase.from("floor_elements").select("section_id").eq("id", elementId).eq("business_id", business.id).maybeSingle();
    const secId = (el?.section_id as string | null) ?? null;
    if (secId) {
      const tz = (business as { timezone?: string }).timezone || "America/Toronto";
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { data: asg } = await supabase
        .from("section_assignments")
        .select("staff_id")
        .eq("business_id", business.id)
        .eq("section_id", secId)
        .eq("shift_date", today)
        .maybeSingle();
      if (asg?.staff_id) attributedStaffId = asg.staff_id as string;
    }
  }
  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      element_id: elementId,
      ticket_type: "table",
      guest_count: guests,
      staff_id: attributedStaffId,
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
    .select("id, element_id, parent_ticket_id")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();

  const elementId = ticket ? ((ticket.element_id as string | null) ?? null) : null;
  const parentTicketId = ticket ? ((ticket.parent_ticket_id as string | null) ?? null) : null;
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

  // P0-4: if this was a split child, close the parent once the last sibling is
  // paid (no more children) and the parent itself carries no items.
  if (parentTicketId) {
    const { count } = await supabase
      .from("open_tickets")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("parent_ticket_id", parentTicketId);
    if (!count || count === 0) {
      const { data: parent } = await supabase
        .from("open_tickets")
        .select("id, element_id, cart")
        .eq("id", parentTicketId)
        .eq("business_id", business.id)
        .maybeSingle();
      const parentItems = (parent?.cart as { items?: unknown[] } | null)?.items ?? [];
      if (parent && parentItems.length === 0) {
        const pEl = (parent.element_id as string | null) ?? null;
        if (pEl) {
          await supabase
            .from("kitchen_tickets")
            .update({ fulfilled_at: new Date().toISOString() })
            .eq("business_id", business.id)
            .eq("element_id", pEl)
            .is("fulfilled_at", null);
        }
        await supabase.from("open_tickets").delete().eq("id", parentTicketId).eq("business_id", business.id);
      }
    }
  }
  return { ok: true };
}

// Fire the not-yet-sent items of a table ticket to the kitchen. Creates a
// kitchen_tickets row (NOT a paid order, so reporting is untouched) and bumps
// each line's sent_qty so re-firing only sends new items. Returns the count
// fired so the register can mark those lines as sent.
const DINING_KDS_LABELS: Record<string, string> = {
  takeout: "Takeout",
  delivery: "Delivery",
  pickup: "Pickup",
};

type FiredItem = { name: string; quantity: number; note?: string | null; seat?: number | null; catalog_item_id?: string | null; allergens?: string[]; allergy?: string | null; prep_minutes?: number | null };

// P1-14: split the just-fired items into one kitchen_tickets row per prep
// station. Each item's station comes from catalog_items.station_id; items with
// no mapped station (or businesses with no stations defined) collapse into a
// single station_id-null ticket — byte-identical to pre-station behaviour.
async function insertFiredByStation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  elementId: string | null,
  baseLabel: string | null,
  fired: FiredItem[],
  createdBy: string | null,
  courseId: string | null = null
): Promise<{ error?: string }> {
  const catIds = Array.from(
    new Set(fired.map((f) => f.catalog_item_id).filter((x): x is string => !!x))
  );
  const stationByItem: Record<string, string> = {};
  const allergensByItem: Record<string, string[]> = {};
  const prepByItem: Record<string, number> = {};
  const nameById: Record<string, string> = {};
  const shortNameById: Record<string, string> = {};
  const separateByItem = new Set<string>();
  const eightySixed = new Set<string>();
  if (catIds.length) {
    const { data } = await supabase
      .from("catalog_items")
      .select("id, name, short_name, station_id, out_of_stock, allergens, prep_minutes, print_separate_ticket")
      .eq("business_id", businessId)
      .in("id", catIds);
    for (const r of data ?? []) {
      const id = r.id as string;
      if (r.station_id) stationByItem[id] = r.station_id as string;
      if (Array.isArray(r.allergens) && r.allergens.length > 0) allergensByItem[id] = r.allergens as string[];
      if (r.prep_minutes != null) prepByItem[id] = Number(r.prep_minutes);
      if (r.out_of_stock === true) eightySixed.add(id);
      if (typeof r.short_name === "string" && r.short_name.trim()) shortNameById[id] = (r.short_name as string).trim();
      if (r.print_separate_ticket === true) separateByItem.add(id);
      nameById[id] = r.name as string;
    }
  }

  // 86 guard: never fire an item that's currently out of stock.
  const blocked = fired.filter((f) => f.catalog_item_id && eightySixed.has(f.catalog_item_id));
  if (blocked.length > 0) {
    const names = Array.from(
      new Set(blocked.map((b) => nameById[b.catalog_item_id as string] || b.name))
    );
    return { error: "Can't fire — 86'd: " + names.join(", ") + ". Remove or un-86 first." };
  }

  // Group fired items by station ("" = no station / default ticket). Item-level
  // allergens ride along on the fired item so the KDS can flag them. Items flagged
  // print_separate_ticket break out onto their own chit (unique group key), while
  // still carrying their real station_id for routing. short_name (if set) replaces
  // the full name on the kitchen chit.
  type Grp = { sid: string; items: FiredItem[] };
  const groups: Record<string, Grp> = {};
  let sepSeq = 0;
  for (const f of fired) {
    const sid = (f.catalog_item_id && stationByItem[f.catalog_item_id]) || "";
    const separate = !!(f.catalog_item_id && separateByItem.has(f.catalog_item_id));
    const key = separate ? sid + "|sep" + sepSeq++ : sid;
    const allergens = f.catalog_item_id ? allergensByItem[f.catalog_item_id] : undefined;
    const prep = f.catalog_item_id ? prepByItem[f.catalog_item_id] : undefined;
    const chitName = (f.catalog_item_id && shortNameById[f.catalog_item_id]) || f.name;
    (groups[key] ||= { sid, items: [] }).items.push({
      name: chitName,
      quantity: f.quantity,
      note: f.note ?? null,
      seat: f.seat ?? null,
      ...(allergens && allergens.length > 0 ? { allergens } : {}),
      ...(f.allergy ? { allergy: f.allergy } : {}),
      ...(prep != null ? { prep_minutes: prep } : {}),
    });
  }

  // Resolve station names for the ticket label suffix.
  const sids = Array.from(new Set(Object.values(groups).map((g) => g.sid).filter(Boolean)));
  const stationName: Record<string, string> = {};
  if (sids.length) {
    const { data } = await supabase
      .from("kitchen_stations")
      .select("id, name")
      .eq("business_id", businessId)
      .in("id", sids);
    for (const r of data ?? []) stationName[r.id as string] = r.name as string;
  }

  const rows = Object.values(groups).map((g) => ({
    business_id: businessId,
    element_id: elementId,
    label: g.sid ? (baseLabel ? baseLabel + " · " : "") + (stationName[g.sid] || "Station") : baseLabel,
    items: g.items,
    station_id: g.sid || null,
    course_id: courseId,
    created_by: createdBy,
  }));
  const { error } = await supabase.from("kitchen_tickets").insert(rows);
  return { error: error ? "Could not send to the kitchen. Please try again." : undefined };
}

export async function sendTableTicket(
  ticketId: string,
  cart: TableCart,
  diningOption?: string | null
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

  // Tag the kitchen ticket with the dining option when it isn't plain dine-in.
  if (diningOption && DINING_KDS_LABELS[diningOption]) {
    label = (label ? label + " · " : "") + DINING_KDS_LABELS[diningOption];
  }

  // Items to fire = quantity beyond what was already sent.
  const fired: FiredItem[] = [];
  const updatedItems = parsed.data.items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const sent = Number(it.sent_qty) || 0;
    const delta = qty - sent;
    if (delta > 0) fired.push({ name: it.name, quantity: delta, note: it.note ?? null, seat: it.seat ?? null, catalog_item_id: it.catalog_item_id ?? null, allergy: it.allergy ?? null });
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

  const ins = await insertFiredByStation(supabase, business.id, elementId, label, fired, user ? user.id : null);
  if (ins.error) {
    return { error: ins.error };
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

// Coursing (P0-1): fire only the not-yet-sent items of ONE course to the
// kitchen. Same kitchen-ticket mechanism as sendTableTicket, but filtered to
// course_id, and stamps fired_at on the lines it fires. Pure kitchen routing —
// no order/total/snapshot is touched. Full-service only (gated in the client).
export async function fireCourse(
  ticketId: string,
  cart: TableCart,
  courseId: string,
  courseName?: string | null,
  diningOption?: string | null
): Promise<{ ok: true; fired: number } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  if (!courseId) return { error: "Missing course." };
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
  if (diningOption && DINING_KDS_LABELS[diningOption]) {
    label = (label ? label + " · " : "") + DINING_KDS_LABELS[diningOption];
  }
  // Name the kitchen ticket after the course being fired.
  if (courseName) label = (label ? label + " · " : "") + courseName;

  const nowIso = new Date().toISOString();
  const fired: FiredItem[] = [];
  const updatedItems = parsed.data.items.map((it) => {
    if ((it.course_id ?? null) !== courseId) return it;
    const qty = Number(it.quantity) || 0;
    const sent = Number(it.sent_qty) || 0;
    const delta = qty - sent;
    if (delta <= 0) return it;
    fired.push({ name: it.name, quantity: delta, note: it.note ?? null, seat: it.seat ?? null, catalog_item_id: it.catalog_item_id ?? null, allergy: it.allergy ?? null });
    return { ...it, sent_qty: qty, fired_at: nowIso };
  });

  if (fired.length === 0) {
    await supabase
      .from("open_tickets")
      .update({ cart: { ...parsed.data, items: updatedItems } })
      .eq("id", ticketId)
      .eq("business_id", business.id);
    return { ok: true, fired: 0 };
  }

  const ins = await insertFiredByStation(supabase, business.id, elementId, label, fired, user ? user.id : null, courseId);
  if (ins.error) {
    return { error: ins.error };
  }

  const { error: updErr } = await supabase
    .from("open_tickets")
    .update({ cart: { ...parsed.data, items: updatedItems } })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (updErr) console.error("fireCourse update:", updErr);

  return { ok: true, fired: fired.reduce((s, f) => s + f.quantity, 0) };
}

// B10 auto-coursing: fire the NEXT unfired course for a table, server-side, from
// its open ticket. Called when a course is fully bumped (if the business opted in).
// Mirrors fireCourse but reads the cart directly (no client payload).
async function autoFireNextCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  elementId: string
): Promise<void> {
  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, cart, label, element_id")
    .eq("business_id", businessId)
    .eq("element_id", elementId)
    .maybeSingle();
  if (!ticket) return;
  const cart = (ticket.cart as TableCart | null) ?? null;
  const items = Array.isArray(cart?.items) ? cart!.items : [];
  if (items.length === 0) return;

  // Course order (lowest sort_order first); items with no course fire last.
  const { data: courses } = await supabase.from("courses").select("id, sort_order").eq("business_id", businessId);
  const order = new Map((courses ?? []).map((c) => [c.id as string, Number(c.sort_order) || 0]));
  const unfiredCourses = Array.from(
    new Set(items.filter((it) => !it.void && (Number(it.quantity) || 0) > (Number(it.sent_qty) || 0)).map((it) => (it.course_id ?? null)))
  );
  if (unfiredCourses.length === 0) return;
  unfiredCourses.sort((a, b) => (order.get(a as string) ?? 9999) - (order.get(b as string) ?? 9999));
  const nextCourse = unfiredCourses[0];
  if (!nextCourse) return; // don't auto-fire the no-course bucket

  let label: string | null = (ticket.label as string | null) ?? null;
  const { data: el } = await supabase.from("floor_elements").select("label").eq("id", elementId).maybeSingle();
  if (el?.label) label = el.label as string;

  const nowIso = new Date().toISOString();
  const fired: FiredItem[] = [];
  const updatedItems = items.map((it) => {
    if ((it.course_id ?? null) !== nextCourse) return it;
    const delta = (Number(it.quantity) || 0) - (Number(it.sent_qty) || 0);
    if (delta <= 0) return it;
    fired.push({ name: it.name, quantity: delta, note: it.note ?? null, seat: it.seat ?? null, catalog_item_id: it.catalog_item_id ?? null, allergy: it.allergy ?? null });
    return { ...it, sent_qty: Number(it.quantity) || 0, fired_at: nowIso };
  });
  if (fired.length === 0) return;
  const ins = await insertFiredByStation(supabase, businessId, elementId, label, fired, null, nextCourse as string);
  if (ins.error) return; // e.g. an item got 86'd — leave it for a human to fire
  await supabase.from("open_tickets").update({ cart: { ...cart!, items: updatedItems } }).eq("id", ticket.id as string).eq("business_id", businessId);
}

// B10: called after a ticket is bumped. If the business opted into auto-coursing
// (settings.auto_course) AND every kitchen ticket for this table+course is now
// bumped, fire the next course automatically. Opt-in, no-op otherwise.
export async function autoFireNextCourseIfReady(
  elementId: string | null,
  courseId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!elementId || !courseId) return { ok: true };
  const { business } = await requireBusiness();
  const settings = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  if (settings.auto_course !== true) return { ok: true };
  const supabase = await createClient();
  const { count } = await supabase
    .from("kitchen_tickets")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("element_id", elementId)
    .eq("course_id", courseId)
    .is("fulfilled_at", null);
  if ((count ?? 0) > 0) return { ok: true }; // this course isn't fully bumped yet
  await autoFireNextCourse(supabase, business.id, elementId);
  return { ok: true };
}

// P0-10: tell the kitchen an already-fired item was voided (stop making it).
// Posts a distinct VOID kitchen ticket; the line stays recorded on the check.
export async function sendVoidNotice(
  ticketId: string,
  item: { name: string; quantity: number }
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: ticket } = await supabase
    .from("open_tickets").select("id, element_id, label")
    .eq("id", ticketId).eq("business_id", business.id).maybeSingle();
  if (!ticket) return { error: "That ticket is no longer open." };
  const elementId = (ticket.element_id as string | null) ?? null;
  let label = (ticket.label as string | null) ?? null;
  if (elementId) {
    const { data: el } = await supabase.from("floor_elements").select("label").eq("id", elementId).eq("business_id", business.id).maybeSingle();
    if (el && el.label) label = el.label as string;
  }
  await supabase.from("kitchen_tickets").insert({
    business_id: business.id,
    element_id: elementId,
    label: "VOID · " + (label || "Ticket"),
    items: [{ name: item.name, quantity: item.quantity, void: true }],
    created_by: user ? user.id : null,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// P0-4: split a table check into separate child checks that pay independently.
// ---------------------------------------------------------------------------

function cartSubtotalCents(cart: TableCart): number {
  return cart.items.reduce((s, it) => s + Math.round(Number(it.unit_price) * Number(it.quantity) * 100), 0);
}

export type ChildTicket = { id: string; label: string; cart: TableCart; subtotal: number };

// Fan a parent ticket into N child checks. The partition (sum of child
// subtotals) must equal the parent's subtotal to the cent, or it is rejected —
// no children are created. Each child becomes an independent open_ticket; the
// parent is emptied and kept as a container until every child is paid.
export async function splitTicketIntoChildren(
  parentId: string,
  kind: string,
  children: { label: string; cart: TableCart }[]
): Promise<{ ok: true; childIds: string[] } | { error: string }> {
  if (!parentId) return { error: "Missing ticket." };
  if (!Array.isArray(children) || children.length < 2) return { error: "Need at least two checks." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: parent } = await supabase
    .from("open_tickets")
    .select("id, element_id, cart, staff_id, parent_ticket_id")
    .eq("id", parentId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!parent) return { error: "That ticket is no longer open." };
  if (parent.parent_ticket_id) return { error: "This is already a split check." };

  const { count: existing } = await supabase
    .from("open_tickets")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("parent_ticket_id", parentId);
  if (existing && existing > 0) return { error: "This check is already split. Un-split it first." };

  const parentParsed = tableCartSchema.safeParse(parent.cart);
  const parentSub = parentParsed.success ? cartSubtotalCents(parentParsed.data) : 0;

  let sum = 0;
  const clean: { label: string; cart: TableCart }[] = [];
  for (const ch of children) {
    const parsed = tableCartSchema.safeParse(ch.cart);
    if (!parsed.success) return { error: "Could not read a split check." };
    const sub = cartSubtotalCents(parsed.data);
    if (sub <= 0) return { error: "Every check needs at least one item." };
    sum += sub;
    clean.push({ label: (ch.label || "Check").slice(0, 80), cart: parsed.data });
  }
  if (sum !== parentSub) return { error: "The split doesn't add up to the check total." };

  const rows = clean.map((ch) => ({
    business_id: business.id,
    parent_ticket_id: parentId,
    element_id: null,
    ticket_type: "table",
    label: ch.label,
    cart: ch.cart,
    staff_id: parent.staff_id,
    created_by: user ? user.id : null,
  }));
  const { data: inserted, error: insErr } = await supabase.from("open_tickets").insert(rows).select("id");
  if (insErr) {
    console.error("splitTicketIntoChildren:", insErr);
    return { error: "Could not create the split checks." };
  }

  const pc = parentParsed.success ? parentParsed.data : ({ items: [] } as TableCart);
  await supabase
    .from("open_tickets")
    .update({ cart: { ...pc, items: [] }, split_kind: kind })
    .eq("id", parentId)
    .eq("business_id", business.id);

  return { ok: true, childIds: (inserted ?? []).map((r) => r.id as string) };
}

export async function listChildTickets(parentId: string): Promise<ChildTicket[]> {
  if (!parentId) return [];
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("open_tickets")
    .select("id, label, cart")
    .eq("business_id", business.id)
    .eq("parent_ticket_id", parentId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => {
    const parsed = tableCartSchema.safeParse(r.cart);
    const cart = parsed.success ? parsed.data : ({ items: [] } as TableCart);
    return { id: r.id as string, label: (r.label as string) || "Check", cart, subtotal: cartSubtotalCents(cart) / 100 };
  });
}

// Re-merge a split back into one check (only while all children are unpaid).
export async function unsplitTicket(parentId: string): Promise<{ ok: true } | { error: string }> {
  if (!parentId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: parent } = await supabase
    .from("open_tickets")
    .select("id, cart")
    .eq("id", parentId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!parent) return { error: "That ticket is no longer open." };
  const { data: kids } = await supabase
    .from("open_tickets")
    .select("id, cart")
    .eq("business_id", business.id)
    .eq("parent_ticket_id", parentId)
    .order("created_at", { ascending: true });

  const pc = tableCartSchema.safeParse(parent.cart);
  const merged: TableCart = pc.success ? { ...pc.data, items: [...pc.data.items] } : { items: [] };
  for (const ch of kids ?? []) {
    const cc = tableCartSchema.safeParse(ch.cart);
    if (cc.success) merged.items.push(...cc.data.items);
  }
  await supabase
    .from("open_tickets")
    .update({ cart: merged, split_kind: null })
    .eq("id", parentId)
    .eq("business_id", business.id);
  if (kids && kids.length > 0) {
    await supabase.from("open_tickets").delete().eq("business_id", business.id).eq("parent_ticket_id", parentId);
  }
  return { ok: true };
}

// P0-5: merge one open check into another. Items (with seat / course / fired
// state / modifiers) move to the destination; the source ticket is removed and
// its table freed. Open tickets only — never a split parent/child or a paid
// order. Fired kitchen tickets are left untouched (the food is already in flight).
export async function mergeTickets(
  fromTicketId: string,
  intoTicketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!fromTicketId || !intoTicketId) return { error: "Pick two checks to merge." };
  if (fromTicketId === intoTicketId) return { error: "Pick two different checks." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("open_tickets")
    .select("id, element_id, cart, parent_ticket_id, split_kind")
    .eq("business_id", business.id)
    .in("id", [fromTicketId, intoTicketId]);
  const from = (rows ?? []).find((r) => r.id === fromTicketId);
  const into = (rows ?? []).find((r) => r.id === intoTicketId);
  if (!from || !into) return { error: "One of those checks is no longer open." };
  if (from.parent_ticket_id || into.parent_ticket_id) return { error: "Can't merge a split check. Un-split it first." };

  const { count: fromKids } = await supabase
    .from("open_tickets").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).eq("parent_ticket_id", fromTicketId);
  const { count: intoKids } = await supabase
    .from("open_tickets").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).eq("parent_ticket_id", intoTicketId);
  if ((fromKids ?? 0) > 0 || (intoKids ?? 0) > 0) return { error: "Un-split before merging." };

  const fromCart = tableCartSchema.safeParse(from.cart);
  const intoCart = tableCartSchema.safeParse(into.cart);
  if (!fromCart.success || !intoCart.success) return { error: "Could not read a check." };

  const merged: TableCart = { ...intoCart.data, items: [...intoCart.data.items, ...fromCart.data.items] };
  const { error: upErr } = await supabase
    .from("open_tickets")
    .update({ cart: merged })
    .eq("id", intoTicketId)
    .eq("business_id", business.id);
  if (upErr) {
    console.error("mergeTickets update:", upErr);
    return { error: "Could not merge the checks." };
  }
  const { error: delErr } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", fromTicketId)
    .eq("business_id", business.id);
  if (delErr) {
    console.error("mergeTickets delete:", delErr);
    return { error: "Merged, but could not free the source table." };
  }
  {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_events").insert({
      business_id: business.id, actor_id: user ? user.id : null, action: "ticket_merge",
      metadata: { from_ticket: fromTicketId, into_ticket: intoTicketId },
    });
  }
  return { ok: true };
}

// P0-6: open table checks an item can be moved to (label + ticket id),
// excluding split parents. The caller filters out the current ticket.
export async function listOpenTableTargets(): Promise<{ ticketId: string; label: string }[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("open_tickets")
    .select("id, element_id")
    .eq("business_id", business.id)
    .is("parent_ticket_id", null)
    .not("element_id", "is", null);
  const ids = (data ?? []).map((t) => t.id as string);
  const childCount: Record<string, number> = {};
  if (ids.length) {
    const { data: kids } = await supabase
      .from("open_tickets").select("parent_ticket_id")
      .eq("business_id", business.id).in("parent_ticket_id", ids);
    for (const k of kids ?? []) {
      const pid = k.parent_ticket_id as string;
      childCount[pid] = (childCount[pid] ?? 0) + 1;
    }
  }
  const elIds = (data ?? []).map((t) => t.element_id as string);
  const labels: Record<string, string> = {};
  if (elIds.length) {
    const { data: els } = await supabase
      .from("floor_elements").select("id, label")
      .eq("business_id", business.id).in("id", elIds);
    for (const e of els ?? []) labels[e.id as string] = (e.label as string) || "Table";
  }
  return (data ?? [])
    .filter((t) => (childCount[t.id as string] ?? 0) === 0)
    .map((t) => ({ ticketId: t.id as string, label: labels[t.element_id as string] || "Table" }));
}

// Append one cart line to another open check (P0-6 transfer item). The caller
// removes the line from the source locally; its autosave persists that removal.
export async function transferLineToTicket(
  destTicketId: string,
  line: unknown
): Promise<{ ok: true } | { error: string }> {
  if (!destTicketId) return { error: "Pick a check." };
  const parsedLine = tableCartLineSchema.safeParse(line);
  if (!parsedLine.success) return { error: "Could not read the item." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: dest } = await supabase
    .from("open_tickets")
    .select("id, cart, parent_ticket_id")
    .eq("id", destTicketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!dest) return { error: "That check is no longer open." };
  if (dest.parent_ticket_id) return { error: "Can't move into a split check." };
  const cart = tableCartSchema.safeParse(dest.cart);
  const merged: TableCart = cart.success
    ? { ...cart.data, items: [...cart.data.items, parsedLine.data] }
    : { items: [parsedLine.data] };
  const { error } = await supabase
    .from("open_tickets")
    .update({ cart: merged })
    .eq("id", destTicketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("transferLineToTicket:", error);
    return { error: "Could not move the item." };
  }
  return { ok: true };
}

// P0-7: tables a check can be moved to (occupied or not), excluding its own.
export async function listTableMoveTargets(
  currentTicketId: string
): Promise<{ elementId: string; label: string; occupied: boolean }[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: els } = await supabase
    .from("floor_elements")
    .select("id, label, sort_order")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .in("kind", ["table", "booth"])
    .order("sort_order", { ascending: true });
  const { data: open } = await supabase
    .from("open_tickets")
    .select("id, element_id")
    .eq("business_id", business.id)
    .is("parent_ticket_id", null)
    .not("element_id", "is", null);
  const occupiedBy: Record<string, string> = {};
  for (const o of open ?? []) occupiedBy[o.element_id as string] = o.id as string;
  return (els ?? [])
    .filter((e) => occupiedBy[e.id as string] !== currentTicketId)
    .map((e) => ({ elementId: e.id as string, label: (e.label as string) || "Table", occupied: !!occupiedBy[e.id as string] }));
}

// Move a whole open check to another table. If the target already has a check,
// the moving check is merged into it; otherwise the check just re-points to the
// new table. The source table is freed. Open checks only (no split parent/child).
export async function moveTicketToTable(
  ticketId: string,
  targetElementId: string
): Promise<{ ok: true; merged: boolean } | { error: string }> {
  if (!ticketId || !targetElementId) return { error: "Missing table." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, element_id, cart, parent_ticket_id")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!ticket) return { error: "That check is no longer open." };
  if (ticket.parent_ticket_id) return { error: "Can't move a split check." };
  if (ticket.element_id === targetElementId) return { ok: true, merged: false };

  const { count: kids } = await supabase
    .from("open_tickets").select("id", { count: "exact", head: true })
    .eq("business_id", business.id).eq("parent_ticket_id", ticketId);
  if ((kids ?? 0) > 0) return { error: "Un-split this check before moving it." };

  const { data: el } = await supabase
    .from("floor_elements")
    .select("id, kind")
    .eq("id", targetElementId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!el || (el.kind !== "table" && el.kind !== "booth")) return { error: "Pick a table." };

  // Occupied target → merge into its check; otherwise re-point this check.
  const { data: targetTicket } = await supabase
    .from("open_tickets")
    .select("id, cart")
    .eq("business_id", business.id)
    .eq("element_id", targetElementId)
    .is("parent_ticket_id", null)
    .maybeSingle();

  if (targetTicket && targetTicket.id !== ticketId) {
    const fromCart = tableCartSchema.safeParse(ticket.cart);
    const intoCart = tableCartSchema.safeParse(targetTicket.cart);
    if (!fromCart.success || !intoCart.success) return { error: "Could not read a check." };
    const merged: TableCart = { ...intoCart.data, items: [...intoCart.data.items, ...fromCart.data.items] };
    await supabase.from("open_tickets").update({ cart: merged }).eq("id", targetTicket.id).eq("business_id", business.id);
    await supabase.from("open_tickets").delete().eq("id", ticketId).eq("business_id", business.id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_events").insert({ business_id: business.id, actor_id: user ? user.id : null, action: "ticket_move", metadata: { ticket_id: ticketId, to_element: targetElementId, merged: true } });
    return { ok: true, merged: true };
  }

  const { error } = await supabase
    .from("open_tickets")
    .update({ element_id: targetElementId })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("moveTicketToTable:", error);
    return { error: "Could not move the check." };
  }
  {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_events").insert({ business_id: business.id, actor_id: user ? user.id : null, action: "ticket_move", metadata: { ticket_id: ticketId, to_element: targetElementId, merged: false } });
  }
  return { ok: true, merged: false };
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
    .select("id, element_id, guest_count, opened_at, cart, staff_id, split_kind, check_dropped_at")
    .eq("business_id", business.id)
    .not("element_id", "is", null);
  if (error) {
    console.error("listOpenTableTickets:", error);
    return [];
  }

  // Count the unpaid child checks per split parent (children have element_id null).
  const parentIds = (data ?? []).map((t) => t.id as string);
  const childCount: Record<string, number> = {};
  const childSub: Record<string, number> = {};
  if (parentIds.length > 0) {
    const { data: kids } = await supabase
      .from("open_tickets")
      .select("parent_ticket_id, cart")
      .eq("business_id", business.id)
      .in("parent_ticket_id", parentIds);
    for (const k of kids ?? []) {
      const pid = k.parent_ticket_id as string;
      childCount[pid] = (childCount[pid] ?? 0) + 1;
      childSub[pid] = (childSub[pid] ?? 0) + cartTotals(k.cart).subtotal;
    }
  }

  const names = await serverNames(supabase, business.id, (data ?? []).map((t) => (t.staff_id as string | null) ?? null));
  return (data ?? []).map((t) => {
    const totals = cartTotals(t.cart);
    const staffId = (t.staff_id as string | null) ?? null;
    const id = t.id as string;
    const kids = childCount[id] ?? 0;
    // P2-27: a guest added items via QR that staff hasn't fired yet.
    const cartItems = ((t.cart as { items?: unknown[] } | null)?.items ?? []) as {
      guest?: boolean; quantity?: number; sent_qty?: number; void?: unknown;
    }[];
    const newGuestItems = cartItems.some(
      (i) => i.guest === true && !i.void && (Number(i.quantity) || 0) - (Number(i.sent_qty) || 0) > 0
    );
    const fired = cartItems.some((i) => !i.void && (Number(i.sent_qty) || 0) > 0);
    const cartObj = (t.cart as { customer?: { name?: string } | null; seat_names?: Record<string, string> } | null) ?? null;
    const guests = [cartObj?.customer?.name ?? "", ...Object.values(cartObj?.seat_names ?? {})].filter(Boolean).join(" ");
    return {
      id: id,
      element_id: t.element_id as string,
      guest_count: (t.guest_count as number | null) ?? null,
      opened_at: t.opened_at as string,
      // A split parent's own items are empty; show the children's combined subtotal.
      item_count: totals.item_count,
      subtotal: kids > 0 ? Math.round((childSub[id] ?? 0) * 100) / 100 : totals.subtotal,
      staff_id: staffId,
      server_name: staffId ? names[staffId] ?? null : null,
      split_kind: (t.split_kind as string | null) ?? null,
      child_count: kids,
      new_guest_items: newGuestItems,
      fired,
      check_dropped_at: (t.check_dropped_at as string | null) ?? null,
      guests,
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

// P1-20: open a bar tab — a table-less check identified by a name only.
export async function openBarTab(
  name?: string | null
): Promise<{ ok: true; ticketId: string; name: string | null } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const active = await getActiveStaff();

  const label = name && name.trim() ? name.trim().slice(0, 80) : null;
  if (!label) return { error: "Enter a name for the tab." };

  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      ticket_type: "tab",
      label: label,
      staff_id: active ? active.id : null,
      cart: { items: [] },
      created_by: user ? user.id : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("openBarTab:", error);
    return { error: "Could not open the tab. Please try again." };
  }
  return { ok: true, ticketId: data.id as string, name: label };
}

// Summaries of all currently-open bar tabs for the floor rail.
export async function listOpenBarTabs(): Promise<BarTabSummary[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, opened_at, cart, staff_id")
    .eq("business_id", business.id)
    .eq("ticket_type", "tab");
  if (error) {
    console.error("listOpenBarTabs:", error);
    return [];
  }

  const names = await serverNames(supabase, business.id, (data ?? []).map((t) => (t.staff_id as string | null) ?? null));
  return (data ?? []).map((t) => {
    const totals = cartTotals(t.cart);
    const staffId = (t.staff_id as string | null) ?? null;
    return {
      id: t.id as string,
      name: (t.label as string | null) ?? null,
      opened_at: t.opened_at as string,
      item_count: totals.item_count,
      subtotal: totals.subtotal,
      staff_id: staffId,
      server_name: staffId ? names[staffId] ?? null : null,
    };
  });
}

// Reassign the server on an open ticket (table or to-go).
// P0-9: assign / transfer a table's server. Assigning an unowned table or
// reassigning your OWN table is free; taking someone else's table as a
// staff/trainee needs a manager PIN. The change is reason-coded into the trail.
export async function setTicketServer(
  ticketId: string,
  staffId: string | null,
  approverPin?: string
): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, staff_id")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!ticket) return { error: "That ticket is no longer open." };
  const currentOwner = (ticket.staff_id as string | null) ?? null;

  const active = await getActiveStaff();
  let approverName: string | null = null;
  // Reassigning a table already owned by someone else, as a staff/trainee, needs
  // a manager's approval.
  if (active && (active.role === "staff" || active.role === "trainee") && currentOwner && currentOwner !== active.id) {
    if (!approverPin) return { needs_approval: true };
    const v = await verifyManagerPin(approverPin);
    if ("error" in v) return { error: v.error };
    approverName = v.name;
  }

  const { error } = await supabase
    .from("open_tickets")
    .update({ staff_id: staffId })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setTicketServer:", error);
    return { error: "Could not change the server." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "table_server_change", order_id: null, reason_code: "server_transfer", reason_note: null,
    metadata: { ticket_id: ticketId, from_staff: currentOwner, to_staff: staffId, by_staff: active?.id ?? null, approved_by: approverName },
  });

  return { ok: true };
}

// End-of-shift handoff: reassign EVERY open ticket owned by one server to
// another. No money math — only ownership changes. Manager-PIN gated when a
// staff/trainee initiates (same gate as voids/refunds).
export async function transferTables(
  fromStaffId: string,
  toStaffId: string,
  approverPin?: string
): Promise<{ ok: true; moved: number } | { needs_approval: true } | { error: string }> {
  if (!fromStaffId || !toStaffId) return { error: "Pick both servers." };
  if (fromStaffId === toStaffId) return { error: "Pick a different server to hand off to." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const active = await getActiveStaff();
  if (active && (active.role === "staff" || active.role === "trainee")) {
    if (!approverPin) return { needs_approval: true };
    const v = await verifyManagerPin(approverPin);
    if ("error" in v) return { error: v.error };
  }

  const { data, error } = await supabase
    .from("open_tickets")
    .update({ staff_id: toStaffId })
    .eq("business_id", business.id)
    .eq("staff_id", fromStaffId)
    .select("id");
  if (error) {
    console.error("transferTables:", error);
    return { error: "Could not transfer the tables. Please try again." };
  }
  return { ok: true, moved: (data ?? []).length };
}
// Phase A: mark the check as dropped (presented to the guest) — drives the live
// floor state and the seat→pay turn-time. Audited; idempotent.
export async function dropCheck(ticketId: string): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing check." };
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("open_tickets")
    .update({ check_dropped_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .is("check_dropped_at", null);
  if (error) {
    console.error("dropCheck:", error);
    return { error: "Could not drop the check." };
  }
  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "check_dropped", metadata: { ticket_id: ticketId },
  });
  return { ok: true };
}
