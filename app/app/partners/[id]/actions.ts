"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function deletePartner(
  id: string
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
  const supabase = await createClient();

  const { count } = await supabase
    .from("trips")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", id);

  if (count && count > 0) {
    return {
      error: `This partner has ${count} trip${
        count === 1 ? "" : "s"
      }. Delete or reassign those trips first.`,
    };
  }

  const { error } = await supabase.from("partners").delete().eq("id", id);

  if (error) {
    console.error("deletePartner:", error);
    return { error: "Could not delete partner." };
  }

  revalidatePath("/app/partners");
  return { ok: true };
}