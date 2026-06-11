"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Check-splitting policy (owner/manager only).
export type SplitSettings = {
  settlementMode: "separate" | "informational";
  allowUnits: boolean;
};

export async function setSplitSettings(
  input: SplitSettings
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const mode = input.settlementMode === "informational" ? "informational" : "separate";
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      split_settlement_mode: mode,
      split_allow_units: !!input.allowUnits,
    })
    .eq("id", business.id);
  if (error) {
    console.error("setSplitSettings:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
