"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

type AddLineItemInput = {
  tripId: string;
  name: string;
  amount: number;
  quantity?: number;
  category?: string;
  presetId?: string;
};

export async function addLineItem(
  input: AddLineItemInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const { business } = await requireBusiness();

  if (!input.name || input.name.trim().length < 1) {
    return { error: "Line item name is required." };
  }
  if (input.name.trim().length > 100) {
    return { error: "Line item name too long (max 100 characters)." };
  }
  if (input.amount == null || isNaN(input.amount)) {
    return { error: "Amount is required." };
  }
  if (input.amount < 0) {
    return { error: "Amount cannot be negative." };
  }
  if (input.amount > 100000) {
    return { error: "Amount looks too large. Double-check the value." };
  }
  const qty = input.quantity ?? 1;
  if (qty < 1 || qty > 999) {
    return { error: "Quantity must be between 1 and 999." };
  }

  const supabase = await createClient();

  // Guard: can't add line items to a paid + settled trip
  const { data: trip } = await supabase
    .from("trips")
    .select("payment_collected, refund_status")
    .eq("id", input.tripId)
    .maybeSingle();

  if (!trip) {
    return { error: "Trip not found." };
  }
  if (trip.refund_status === "completed") {
    return { error: "Cannot add line items to a refunded trip." };
  }

  const { data, error } = await supabase
    .from("trip_line_items")
    .insert({
      trip_id: input.tripId,
      business_id: business.id,
      name: input.name.trim(),
      amount: input.amount,
      quantity: qty,
      category: input.category ?? null,
      preset_id: input.presetId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("addLineItem:", error);
    return { error: "Could not add line item." };
  }

  revalidatePath(`/app/trips/${input.tripId}`);
  revalidatePath("/app/trips");
  return { ok: true, id: data.id };
}

export async function deleteLineItem(input: {
  id: string;
  tripId: string;
}): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  // Guard: don't allow deletion if trip is refunded
  const { data: trip } = await supabase
    .from("trips")
    .select("refund_status")
    .eq("id", input.tripId)
    .maybeSingle();

  if (trip?.refund_status === "completed") {
    return { error: "Cannot remove line items from a refunded trip." };
  }

  const { error } = await supabase
    .from("trip_line_items")
    .delete()
    .eq("id", input.id);

  if (error) {
    console.error("deleteLineItem:", error);
    return { error: "Could not remove line item." };
  }

  revalidatePath(`/app/trips/${input.tripId}`);
  revalidatePath("/app/trips");
  return { ok: true };
}