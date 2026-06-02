"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

export async function dismissOnboarding(): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const current =
    (business as { onboarding?: Record<string, unknown> }).onboarding ?? {};
  const merged = { ...current, dismissed: true };

  const { error } = await supabase
    .from("businesses")
    .update({ onboarding: merged })
    .eq("id", business.id);

  if (error) {
    console.error("dismissOnboarding:", error);
    return { error: "Could not update setup status." };
  }
  return { ok: true };
}