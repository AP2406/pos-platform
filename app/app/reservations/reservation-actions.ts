"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";

// P2-30 reservations + waitlist. A row with scheduled_at is a future booking;
// scheduled_at null is a walk-in waitlist entry.
export type Reservation = {
  id: string;
  guest_name: string;
  party_size: number;
  phone: string | null;
  email: string | null;
  scheduled_at: string | null;
  quoted_wait_min: number | null;
  element_id: string | null;
  status: string;
  notes: string | null;
  source: string;
};

const RES_COLS = "id, guest_name, party_size, phone, email, scheduled_at, quoted_wait_min, element_id, status, notes, source";

// Total seatable capacity = count of seat elements on the floor.
async function totalSeats(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string): Promise<number> {
  const { count } = await supabase
    .from("floor_elements")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", "seat")
    .neq("is_active", false);
  return count ?? 0;
}

// Soft overbooking check: parties already booked within ±90 min of the slot,
// against floor capacity. Returns a warning string (never blocks).
async function capacityWarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  scheduledIso: string,
  party: number
): Promise<string | null> {
  const seats = await totalSeats(supabase, businessId);
  if (seats <= 0) return null; // no floor mapped — can't assess
  const at = new Date(scheduledIso).getTime();
  const lo = new Date(at - 90 * 60000).toISOString();
  const hi = new Date(at + 90 * 60000).toISOString();
  const { data } = await supabase
    .from("reservations")
    .select("party_size")
    .eq("business_id", businessId)
    .in("status", ["booked", "seated"])
    .gte("scheduled_at", lo)
    .lte("scheduled_at", hi);
  const booked = (data ?? []).reduce((s, r) => s + (Number(r.party_size) || 0), 0);
  if (booked + party > seats) {
    return `Heads up: ${booked + party} guests booked around this time vs ${seats} seats — you may be overbooked.`;
  }
  return null;
}

// Confirmation email (best-effort) when a booking has an email.
async function sendConfirmation(business: { name?: string; timezone?: string }, r: Reservation): Promise<void> {
  if (!r.email || !r.scheduled_at || !isEmailConfigured()) return;
  const tz = business.timezone || "America/Toronto";
  const when = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(r.scheduled_at));
  const biz = business.name || "the restaurant";
  await sendEmail({
    to: r.email,
    subject: `Reservation confirmed — ${biz}`,
    html: `<h2>You're booked at ${biz}</h2><p>Hi ${r.guest_name},</p><p>Your table for <strong>${r.party_size}</strong> is confirmed for <strong>${when}</strong>.</p><p>See you then! Reply to this email if you need to change anything.</p>`,
  });
}

const STATUSES = ["booked", "waitlisted", "seated", "cancelled", "no_show", "done"];

function mapRow(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    guest_name: (r.guest_name as string | null) ?? "",
    party_size: Number(r.party_size) || 1,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    scheduled_at: (r.scheduled_at as string | null) ?? null,
    quoted_wait_min: r.quoted_wait_min == null ? null : Number(r.quoted_wait_min),
    element_id: (r.element_id as string | null) ?? null,
    status: (r.status as string | null) ?? "booked",
    notes: (r.notes as string | null) ?? null,
    source: (r.source as string | null) ?? "staff",
  };
}

// Active reservations + waitlist (excludes closed-out rows), newest-relevant first.
export async function listReservations(): Promise<Reservation[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(RES_COLS)
    .eq("business_id", business.id)
    .in("status", ["booked", "waitlisted", "seated"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapRow);
}

// Compact summary for the POS floor: how many are waiting + the next booking.
export type ReservationSummary = {
  waitlist: number;
  next: { name: string; at: string; party: number } | null;
};

export async function getReservationSummary(): Promise<ReservationSummary> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [waitRes, nextRes] = await Promise.all([
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "waitlisted"),
    supabase
      .from("reservations")
      .select("guest_name, scheduled_at, party_size")
      .eq("business_id", business.id)
      .eq("status", "booked")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    waitlist: waitRes.count ?? 0,
    next: nextRes.data
      ? {
          name: nextRes.data.guest_name as string,
          at: nextRes.data.scheduled_at as string,
          party: Number(nextRes.data.party_size) || 1,
        }
      : null,
  };
}

export async function createReservation(input: {
  guest_name: string;
  party_size: number;
  phone?: string;
  email?: string;
  scheduled_at?: string | null; // ISO, or null/empty for waitlist
  quoted_wait_min?: number | null;
  notes?: string;
}): Promise<{ ok: true; reservation: Reservation; warning: string | null } | { error: string }> {
  const { business } = await requireBusiness();
  const name = (input.guest_name || "").trim().slice(0, 120);
  if (!name) return { error: "Enter a guest name." };
  let party = Math.round(Number(input.party_size) || 0);
  if (party < 1) party = 1;
  if (party > 99) party = 99;

  const scheduled = input.scheduled_at && input.scheduled_at.trim() ? input.scheduled_at : null;
  const status = scheduled ? "booked" : "waitlisted";
  const wait = input.quoted_wait_min == null ? null : Math.max(0, Math.min(600, Math.round(Number(input.quoted_wait_min))));

  const supabase = await createClient();

  // Capacity-aware: warn (don't block) if the slot looks overbooked.
  let warning: string | null = null;
  if (scheduled) warning = await capacityWarning(supabase, business.id, scheduled, party);

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      business_id: business.id,
      guest_name: name,
      party_size: party,
      phone: (input.phone || "").trim().slice(0, 40) || null,
      email: (input.email || "").trim().slice(0, 120) || null,
      scheduled_at: scheduled,
      quoted_wait_min: status === "waitlisted" ? wait : null,
      status,
      source: "staff",
      notes: (input.notes || "").trim().slice(0, 500) || null,
    })
    .select(RES_COLS)
    .single();
  if (error || !data) {
    console.error("createReservation:", error);
    return { error: "Could not save the reservation." };
  }
  const reservation = mapRow(data);
  await sendConfirmation(business as { name?: string; timezone?: string }, reservation);
  revalidatePath("/app/reservations");
  return { ok: true, reservation, warning };
}

// Toggle the public online-booking page for the business (owner/manager).
export async function setOnlineBooking(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, online_booking_enabled: enabled } })
    .eq("id", business.id);
  if (error) {
    console.error("setOnlineBooking:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setReservationStatus(
  id: string,
  status: string,
  elementId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  if (!STATUSES.includes(status)) return { error: "Unknown status." };
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "seated") patch.element_id = elementId ?? null;
  const { error } = await supabase
    .from("reservations")
    .update(patch)
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setReservationStatus:", error);
    return { error: "Could not update the reservation." };
  }
  revalidatePath("/app/reservations");
  return { ok: true };
}
