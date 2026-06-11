"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// How chairs behave in the floor editor: 'follow' (chairs auto-arrange and move
// with their table) or 'editable' (chairs can also be nudged/removed one by one).
export async function setFloorChairMode(
  mode: "follow" | "editable"
): Promise<{ ok: true } | { error: string }> {
  if (mode !== "follow" && mode !== "editable") return { error: "Invalid option." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ floor_chair_mode: mode })
    .eq("id", business.id);
  if (error) {
    console.error("setFloorChairMode:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
