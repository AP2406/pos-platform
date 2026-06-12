"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P2-30 reservations + waitlist. A row with scheduled_at is a future booking;
// scheduled_at null is a walk-in waitlist entry.
export type Reservation = {
  id: string;
  guest_name: string;
  party_size: number;
  phone: string | null;
  scheduled_at: string | null;
  quoted_wait_min: number | null;
  element_id: string | null;
  status: string;
  notes: string | null;
};

const STATUSES = ["booked", "waitlisted", "seated", "cancelled", "no_show", "done"];

function mapRow(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    guest_name: (r.guest_name as string | null) ?? "",
    party_size: Number(r.party_size) || 1,
    phone: (r.phone as string | null) ?? null,
    scheduled_at: (r.scheduled_at as string | null) ?? null,
    quoted_wait_min: r.quoted_wait_min == null ? null : Number(r.quoted_wait_min),
    element_id: (r.element_id as string | null) ?? null,
    status: (r.status as string | null) ?? "booked",
    notes: (r.notes as string | null) ?? null,
  };
}

// Active reservations + waitlist (excludes closed-out rows), newest-relevant first.
export async function listReservations(): Promise<Reservation[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select("id, guest_name, party_size, phone, scheduled_at, quoted_wait_min, element_id, status, notes")
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
  scheduled_at?: string | null; // ISO, or null/empty for waitlist
  quoted_wait_min?: number | null;
  notes?: string;
}): Promise<{ ok: true; reservation: Reservation } | { error: string }> {
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
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      business_id: business.id,
      guest_name: name,
      party_size: party,
      phone: (input.phone || "").trim().slice(0, 40) || null,
      scheduled_at: scheduled,
      quoted_wait_min: status === "waitlisted" ? wait : null,
      status,
      notes: (input.notes || "").trim().slice(0, 500) || null,
    })
    .select("id, guest_name, party_size, phone, scheduled_at, quoted_wait_min, element_id, status, notes")
    .single();
  if (error || !data) {
    console.error("createReservation:", error);
    return { error: "Could not save the reservation." };
  }
  revalidatePath("/app/reservations");
  return { ok: true, reservation: mapRow(data) };
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
