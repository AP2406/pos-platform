"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

const WASTE_REASONS = ["spoilage", "prep", "spill", "expired", "other"];

export async function logWaste(input: {
  ingredient_id: string;
  quantity: number;
  reason: string;
  note?: string;
}): Promise<{ ok: true; new_qty: number } | { error: string }> {
  if (!input.ingredient_id) return { error: "Pick an ingredient." };
  const qty = Math.round((Number(input.quantity) || 0) * 10000) / 10000;
  if (qty <= 0) return { error: "Enter a quantity greater than zero." };
  const reason = WASTE_REASONS.includes(input.reason) ? input.reason : "other";

  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can log waste." };
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("log_waste", {
    p_business_id: business.id,
    p_ingredient_id: input.ingredient_id,
    p_quantity: qty,
    p_reason: reason,
    p_note: input.note?.trim() ? input.note.trim().slice(0, 300) : null,
  });

  if (error || data === null || data === undefined) {
    const m = error?.message || "";
    if (m.includes("ingredient_not_found")) return { error: "Ingredient not found." };
    if (m.includes("invalid_quantity")) return { error: "Enter a quantity greater than zero." };
    console.error("logWaste:", error);
    return { error: "Could not log the waste. Please try again." };
  }
  revalidatePath("/app/waste");
  return { ok: true, new_qty: Number(data) };
}

// Remove a waste log entry. Note: this does NOT restore stock (the physical loss
// already happened); it only corrects the record. Adjust stock separately if the
// entry was a mistake.
export async function deleteWaste(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing entry." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can edit waste." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("waste_events")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteWaste:", error);
    return { error: "Could not remove the entry. Please try again." };
  }
  revalidatePath("/app/waste");
  return { ok: true };
}
