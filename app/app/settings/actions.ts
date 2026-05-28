"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function updateBusinessSettings(input: {
  name: string;
  timezone: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();

  if (role !== "owner") {
    return { error: "Only owners can change settings." };
  }
  if (!input.name || input.name.trim().length < 2) {
    return { error: "Business name must be at least 2 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ name: input.name.trim(), timezone: input.timezone })
    .eq("id", business.id);

  if (error) {
    console.error("updateBusinessSettings:", error);
    return { error: "Could not save settings. Please try again." };
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { ok: true };
}