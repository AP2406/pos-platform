"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function setTrainingMode(
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner") {
    return { error: "Only an owner can change training mode." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ training_mode: enabled })
    .eq("id", business.id);
  if (error) {
    console.error("setTrainingMode:", error);
    return { error: "Could not update training mode. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}