"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Loss-prevention thresholds. The UI passes rates as PERCENTS and the alert as
// dollars; we store rates as fractions on businesses.settings.exception_thresholds.
export async function setExceptionThresholds(input: {
  voidPct: number;
  compPct: number;
  discountPct: number;
  refundPct: number;
  alertVoidAmount: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }

  const clampPct = (v: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(100, Math.round(n * 10) / 10);
  };
  const alert = Math.max(0, Math.min(100000, Math.round((Number(input.alertVoidAmount) || 0) * 100) / 100));

  const next = {
    voidRate: clampPct(input.voidPct) / 100,
    compRate: clampPct(input.compPct) / 100,
    discountRate: clampPct(input.discountPct) / 100,
    refundRate: clampPct(input.refundPct) / 100,
    alertVoidAmount: alert,
  };

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const merged = { ...current, exception_thresholds: next };
  const { error } = await supabase.from("businesses").update({ settings: merged }).eq("id", business.id);
  if (error) {
    console.error("setExceptionThresholds:", error);
    return { error: "Could not save the thresholds." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/exceptions");
  return { ok: true };
}
