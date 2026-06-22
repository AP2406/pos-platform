"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D1: schedule-enforced clock-in. settings.clock_enforcement { enabled, graceMin }.
// When on, a staff PIN clock-in off-schedule (or more than graceMin before the
// shift) is blocked unless a manager PIN overrides it.
export async function setClockEnforcement(input: {
  enabled: boolean;
  graceMin: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const graceMin = Math.min(120, Math.max(0, Math.round(Number(input.graceMin) || 0)));
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, clock_enforcement: { enabled: !!input.enabled, graceMin } } })
    .eq("id", business.id);
  if (error) {
    console.error("setClockEnforcement:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/clock");
  return { ok: true };
}
