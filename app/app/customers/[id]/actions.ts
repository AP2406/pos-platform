"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function deleteCustomer(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  // Block delete if customer has trips
  const { count } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", id);

  if (count && count > 0) {
    return {
      error: `This customer has ${count} trip${
        count === 1 ? "" : "s"
      }. Delete or reassign those trips first.`,
    };
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    console.error("deleteCustomer:", error);
    return { error: "Could not delete customer." };
  }

  revalidatePath("/app/customers");
  return { ok: true };
}