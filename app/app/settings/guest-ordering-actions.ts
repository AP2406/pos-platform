"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P2-27 toggle QR guest ordering for the business (owner/manager). Off by default;
// when on, guests can add to an OPEN table check via the per-table order link.
export async function setGuestOrdering(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ guest_ordering_enabled: enabled })
    .eq("id", business.id);
  if (error) {
    console.error("setGuestOrdering:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
