"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Service charge / auto-gratuity configuration (owner/manager only). The amount
// is recomputed authoritatively on the server at sale time from these values;
// this just stores the policy.
export type ServiceChargeSettings = {
  enabled: boolean;
  pct: number;
  autoParty: number;
  postTax: boolean;
  label: string;
};

export async function setServiceCharge(
  input: ServiceChargeSettings
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }

  let pct = Number(input.pct);
  if (!Number.isFinite(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  pct = Math.round(pct * 1000) / 1000;

  let autoParty = Math.round(Number(input.autoParty));
  if (!Number.isFinite(autoParty) || autoParty < 0) autoParty = 0;
  if (autoParty > 999) autoParty = 999;

  const label = (input.label || "").trim().slice(0, 40) || "Service charge";

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      service_charge_enabled: !!input.enabled,
      service_charge_pct: pct,
      service_charge_auto_party: autoParty,
      service_charge_post_tax: !!input.postTax,
      service_charge_label: label,
    })
    .eq("id", business.id);
  if (error) {
    console.error("setServiceCharge:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
