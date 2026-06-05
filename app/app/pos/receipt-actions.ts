"use server";

import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { mergeReceiptSettings, type ReceiptSettings } from "./receipt-template";

export async function saveReceiptSettings(input: Partial<ReceiptSettings>): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner") {
    return { error: "Only the owner can change receipt settings." };
  }
  const merged = mergeReceiptSettings(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ receipt_settings: merged })
    .eq("id", business.id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}