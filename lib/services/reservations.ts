import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { sendSms, isSmsConfigured } from "@/lib/services/sms";

// Reservations + waitlist — front-of-house state, money-independent. Fresh cores
// the v1 routes call; they mirror app/app/reservations/reservation-actions.ts and
// PRESERVE its comms side-effects (booking confirmation email, table-ready
// SMS/email). Unify with the web action later.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export type ReservationRow = {
  id: string;
  guestName: string;
  partySize: number;
  phone: string | null;
  email: string | null;
  scheduledAt: string | null;
  quotedWaitMin: number | null;
  elementId: string | null;
  status: string;
  notes: string | null;
  pagedAt: string | null;
};

const RES_COLS = "id, guest_name, party_size, phone, email, scheduled_at, quoted_wait_min, element_id, status, notes, paged_at";
const STATUSES = ["booked", "waitlisted", "seated", "cancelled", "no_show", "done"];

function mapRow(r: Record<string, unknown>): ReservationRow {
  return {
    id: r.id as string,
    guestName: (r.guest_name as string | null) ?? "",
    partySize: Number(r.party_size) || 1,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    scheduledAt: (r.scheduled_at as string | null) ?? null,
    quotedWaitMin: r.quoted_wait_min == null ? null : Number(r.quoted_wait_min),
    elementId: (r.element_id as string | null) ?? null,
    status: (r.status as string | null) ?? "booked",
    notes: (r.notes as string | null) ?? null,
    pagedAt: (r.paged_at as string | null) ?? null,
  };
}

async function bizMeta(supabase: Sb, businessId: string): Promise<{ name: string; timezone: string }> {
  const { data } = await supabase.from("businesses").select("name, timezone").eq("id", businessId).maybeSingle();
  return { name: (data?.name as string | null) || "the restaurant", timezone: (data?.timezone as string | null) || "America/Toronto" };
}

// Soft overbooking warning (never blocks): parties booked within ±90 min vs seats.
async function capacityWarning(supabase: Sb, businessId: string, scheduledIso: string, party: number): Promise<string | null> {
  const { count } = await supabase
    .from("floor_elements")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", "seat")
    .neq("is_active", false);
  const seats = count ?? 0;
  if (seats <= 0) return null;
  const at = new Date(scheduledIso).getTime();
  const { data } = await supabase
    .from("reservations")
    .select("party_size")
    .eq("business_id", businessId)
    .in("status", ["booked", "seated"])
    .gte("scheduled_at", new Date(at - 90 * 60000).toISOString())
    .lte("scheduled_at", new Date(at + 90 * 60000).toISOString());
  const booked = (data ?? []).reduce((s, r) => s + (Number(r.party_size) || 0), 0);
  if (booked + party > seats) return `Heads up: ${booked + party} guests booked around this time vs ${seats} seats — you may be overbooked.`;
  return null;
}

export type CreateReservationArgs = {
  businessId: string;
  guestName: string;
  partySize: number;
  phone?: string | null;
  email?: string | null;
  scheduledAt?: string | null;
  quotedWaitMin?: number | null;
  notes?: string | null;
};

export async function createReservationCore(supabase: Sb, args: CreateReservationArgs): Promise<{ reservation: ReservationRow; warning: string | null } | { error: string }> {
  const name = (args.guestName || "").trim().slice(0, 120);
  if (!name) return { error: "Enter a guest name." };
  let party = Math.round(Number(args.partySize) || 0);
  party = Math.max(1, Math.min(99, party));

  const scheduled = args.scheduledAt && args.scheduledAt.trim() ? args.scheduledAt : null;
  const status = scheduled ? "booked" : "waitlisted";
  const wait = args.quotedWaitMin == null ? null : Math.max(0, Math.min(600, Math.round(Number(args.quotedWaitMin))));

  let warning: string | null = null;
  if (scheduled) warning = await capacityWarning(supabase, args.businessId, scheduled, party);

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      business_id: args.businessId,
      guest_name: name,
      party_size: party,
      phone: (args.phone || "").trim().slice(0, 40) || null,
      email: (args.email || "").trim().slice(0, 120) || null,
      scheduled_at: scheduled,
      quoted_wait_min: status === "waitlisted" ? wait : null,
      status,
      source: "staff",
      notes: (args.notes || "").trim().slice(0, 500) || null,
    })
    .select(RES_COLS)
    .single();
  if (error || !data) {
    console.error("createReservationCore:", error);
    return { error: "Could not save the reservation." };
  }
  const reservation = mapRow(data);

  // Best-effort booking confirmation (preserves the web side-effect).
  if (reservation.email && reservation.scheduledAt && isEmailConfigured()) {
    const { name: bizName, timezone } = await bizMeta(supabase, args.businessId);
    const when = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(reservation.scheduledAt));
    await sendEmail({
      to: reservation.email,
      subject: `Reservation confirmed — ${bizName}`,
      html: `<h2>You're booked at ${bizName}</h2><p>Hi ${reservation.guestName},</p><p>Your table for <strong>${reservation.partySize}</strong> is confirmed for <strong>${when}</strong>.</p><p>See you then! Reply to this email if you need to change anything.</p>`,
    });
  }
  return { reservation, warning };
}

export async function setReservationStatusCore(supabase: Sb, businessId: string, id: string, status: string, elementId?: string | null): Promise<{ ok: true } | { error: string }> {
  if (!STATUSES.includes(status)) return { error: "Unknown status." };
  const patch: Record<string, unknown> = { status };
  if (status === "seated") patch.element_id = elementId ?? null;
  const { error } = await supabase.from("reservations").update(patch).eq("id", id).eq("business_id", businessId);
  if (error) {
    console.error("setReservationStatusCore:", error);
    return { error: "Could not update the reservation." };
  }
  return { ok: true };
}

// Page a waitlisted guest that their table is ready — SMS first, email fallback.
export async function pageWaitlistGuestCore(supabase: Sb, businessId: string, id: string): Promise<{ ok: true; channel: "sms" | "email" } | { error: string }> {
  const { data: r } = await supabase
    .from("reservations")
    .select("id, guest_name, phone, email")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!r) return { error: "Guest not found." };

  const name = (r.guest_name as string | null) || "there";
  const phone = (r.phone as string | null) || "";
  const email = (r.email as string | null) || "";
  const { name: bizName } = await bizMeta(supabase, businessId);
  const msg = `Hi ${name}, your table at ${bizName} is ready! Please see the host.`;

  let channel: "sms" | "email" | null = null;
  if (isSmsConfigured() && phone) {
    const res = await sendSms({ to: phone, body: msg });
    if ("ok" in res) channel = "sms";
  }
  if (!channel && isEmailConfigured() && email.includes("@")) {
    const res = await sendEmail({ to: email, subject: `Your table at ${bizName} is ready`, html: `<p>Hi ${name},</p><p>Your table at <strong>${bizName}</strong> is ready — please see the host. See you shortly!</p>` });
    if (!("error" in res)) channel = "email";
  }
  if (!channel) {
    if (!phone && !email) return { error: "No phone or email on file for this guest." };
    return { error: "Could not reach the guest. Check the contact details." };
  }

  await supabase.from("reservations").update({ paged_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId);
  return { ok: true, channel };
}
