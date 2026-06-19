"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Overtime rule on businesses.settings.overtime { weekly_hours, multiplier }.
export async function setOvertime(input: {
  weeklyHours: number;
  multiplier: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const weekly = Math.round(Number(input.weeklyHours) || 0);
  const mult = Math.round((Number(input.multiplier) || 0) * 100) / 100;
  if (weekly < 1 || weekly > 80) return { error: "Weekly threshold must be 1–80 hours." };
  if (mult < 1 || mult > 3) return { error: "Multiplier must be between 1 and 3." };

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const next = { ...current, overtime: { weekly_hours: weekly, multiplier: mult } };
  const { error } = await supabase.from("businesses").update({ settings: next }).eq("id", business.id);
  if (error) {
    console.error("setOvertime:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/labor");
  return { ok: true };
}
