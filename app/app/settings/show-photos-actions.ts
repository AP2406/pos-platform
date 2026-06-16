"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function setShowItemPhotos(
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner") {
    return { error: "Only an owner can change this setting." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ show_item_photos: enabled })
    .eq("id", business.id);
  if (error) {
    console.error("setShowItemPhotos:", error);
    return { error: "Could not update the setting. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}
