"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// B9: KDS aging thresholds on businesses.settings.kds { warnMin, lateMin }. A
// ticket turns amber at warnMin and red at lateMin (per-item prep_minutes still
// overrides per ticket).
export async function setKdsThresholds(input: {
  warnMin: number;
  lateMin: number;
  autoCourse?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const warn = Math.round(Number(input.warnMin) || 0);
  const late = Math.round(Number(input.lateMin) || 0);
  if (warn < 1 || warn > 120) return { error: "Warn minutes must be 1–120." };
  if (late <= warn || late > 180) return { error: "Late minutes must be greater than warn and ≤ 180." };

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, kds: { warnMin: warn, lateMin: late }, auto_course: input.autoCourse === true } })
    .eq("id", business.id);
  if (error) {
    console.error("setKdsThresholds:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/kitchen");
  return { ok: true };
}
