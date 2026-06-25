"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// GAP-1 (2/5): toggle commission-free online pickup ordering (owner/manager). Off by
// default; when on, /order/<businessId> lets customers place a togo pickup order that
// fires to the kitchen tagged channel='online'. No online payment — pay at pickup.
export async function setOnlineOrdering(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ online_ordering_enabled: enabled })
    .eq("id", business.id);
  if (error) {
    console.error("setOnlineOrdering:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
