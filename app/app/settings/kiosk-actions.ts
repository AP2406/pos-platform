"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P3-44 toggle self-ordering kiosk for the business (owner/manager). Off by default;
// when on, the /kiosk/<businessId> page lets customers self-order a togo check that
// fires to the kitchen. No online payment — staff charge at the counter.
export async function setKioskOrdering(enabled: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ kiosk_ordering_enabled: enabled })
    .eq("id", business.id);
  if (error) {
    console.error("setKioskOrdering:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
