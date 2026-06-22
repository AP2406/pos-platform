"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D4: labor-target alerts. settings.labor_target { enabled, targetPct }. When
// today's labor % crosses the target, managers get a push (once/day) — mirroring
// the void-over-$ alert. The Labor page also shows the target line.
export async function setLaborTarget(input: {
  enabled: boolean;
  targetPct: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const targetPct = Math.min(100, Math.max(1, Math.round((Number(input.targetPct) || 0) * 10) / 10));
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const prev = (current.labor_target ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, labor_target: { ...prev, enabled: !!input.enabled, targetPct } } })
    .eq("id", business.id);
  if (error) {
    console.error("setLaborTarget:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/labor");
  return { ok: true };
}
