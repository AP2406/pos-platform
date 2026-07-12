"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { type KitchenTicketConfig, parseKitchenTicketConfig } from "@/lib/services/kitchen-ticket-config";

export async function saveKitchenTicketConfig(config: KitchenTicketConfig): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change the kitchen ticket." };
  // Normalize through the parser so only known boolean keys are stored.
  const clean = parseKitchenTicketConfig({ kitchen_ticket: config });

  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, kitchen_ticket: clean } })
    .eq("id", business.id);
  if (error) {
    console.error("saveKitchenTicketConfig:", error);
    return { error: "Could not save the kitchen ticket settings." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/kitchen");
  revalidatePath("/app/pos");
  return { ok: true };
}
