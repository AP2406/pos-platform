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