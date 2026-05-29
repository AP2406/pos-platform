"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

type TripStatus =
  | "booked"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export async function updateTripStatus(
  id: string,
  status: TripStatus
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ trip_status: status })
    .eq("id", id);

  if (error) {
    console.error("updateTripStatus:", error);
    return { error: "Could not update status." };
  }
  revalidatePath("/app/trips");
  revalidatePath(`/app/trips/${id}`);
  return { ok: true };
}

export async function togglePaymentCollected(
  id: string,
  collected: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ payment_collected: collected })
    .eq("id", id);

  if (error) {
    console.error("togglePaymentCollected:", error);
    return { error: "Could not update payment status." };
  }
  revalidatePath("/app/trips");
  revalidatePath(`/app/trips/${id}`);
  return { ok: true };
}

export async function toggleCookieCollected(
  id: string,
  collected: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trips")
    .update({ cookie_collected: collected })
    .eq("id", id);

  if (error) {
    console.error("toggleCookieCollected:", error);
    return { error: "Could not update cookie status." };
  }
  revalidatePath("/app/trips");
  revalidatePath(`/app/trips/${id}`);
  return { ok: true };
}

export async function deleteTrip(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase.from("trips").delete().eq("id", id);

  if (error) {
    console.error("deleteTrip:", error);
    return { error: "Could not delete trip." };
  }
  revalidatePath("/app/trips");
  return { ok: true };
}

export async function refundTrip(input: {
  id: string;
  amount: number;
  reason: string;
}): Promise<{ ok: true } | { error: string }> {
  const { role } = await requireBusiness();

  if (role !== "owner" && role !== "manager") {
    return { error: "Only owners or managers can issue refunds." };
  }
  if (!input.amount || input.amount <= 0) {
    return { error: "Refund amount must be greater than zero." };
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { error: "Please provide a refund reason (3+ characters)." };
  }

  const supabase = await createClient();

  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select("price_total, refund_status")
    .eq("id", input.id)
    .maybeSingle();

  if (fetchError || !trip) {
    return { error: "Could not find that trip." };
  }
  if (trip.refund_status === "completed") {
    return { error: "This trip has already been refunded." };
  }
  if (input.amount > parseFloat(trip.price_total)) {
    return { error: "Refund amount cannot exceed the trip price." };
  }

  const { error } = await supabase
    .from("trips")
    .update({
      refund_amount: input.amount,
      refund_reason: input.reason.trim(),
      refund_status: "completed",
      refunded_at: new Date().toISOString(),
      refund_processor: "manual",
    })
    .eq("id", input.id);

  if (error) {
    console.error("refundTrip:", error);
    return { error: "Could not record the refund. Please try again." };
  }

  revalidatePath("/app/trips");
  revalidatePath(`/app/trips/${input.id}`);
  return { ok: true };
}