"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Lock a fiscal period through a date (owner only). After this, sales dated
// on/before the date can't be voided/reopened/adjusted.
export async function setPeriodLock(
  throughDate: string
): Promise<{ ok: true } | { error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(throughDate || "")) {
    return { error: "Invalid date." };
  }
  const { business, role } = await requireBusiness();
  if (role !== "owner") return { error: "Only an owner can lock a period." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("period_locks").insert({
    business_id: business.id,
    locked_through: throughDate,
    locked_by: user ? user.id : null,
  });
  if (error) {
    console.error("setPeriodLock:", error);
    return { error: "Could not lock the period." };
  }
  revalidatePath("/app/accounting");
  return { ok: true };
}
