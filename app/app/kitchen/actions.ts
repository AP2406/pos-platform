"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function markOrderFulfilled(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("markOrderFulfilled:", error);
    return { error: "Could not update the order." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}