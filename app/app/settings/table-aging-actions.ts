"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P0-12: how long a seated table waits before it turns yellow, then red, on the
// live floor. Stored on businesses.settings.table_aging (jsonb, merged).
export async function setTableAging(
  input: { yellowMin: number; redMin: number }
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  let yellow = Math.round(Number(input.yellowMin));
  let red = Math.round(Number(input.redMin));
  if (!Number.isFinite(yellow) || yellow < 1) yellow = 30;
  if (!Number.isFinite(red) || red < 1) red = 50;
  if (red <= yellow) red = yellow + 1;
  if (yellow > 600) yellow = 600;
  if (red > 600) red = 600;

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const next = { ...current, table_aging: { yellow_min: yellow, red_min: red } };
  const { error } = await supabase.from("businesses").update({ settings: next }).eq("id", business.id);
  if (error) {
    console.error("setTableAging:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
