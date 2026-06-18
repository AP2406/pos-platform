"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Business-day cutoff (HH:MM, local) + who receives the auto-emailed Z-report.
// Stored on businesses.settings (jsonb, merged).
export async function setDayClose(input: {
  cutoff: string;
  emails: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }

  const cutoff = (input.cutoff || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(cutoff)) {
    return { error: "Enter the cutoff as HH:MM (e.g. 04:00)." };
  }
  const [h, m] = cutoff.split(":").map((x) => Number(x));
  if (h > 23 || m > 59) return { error: "That isn't a valid time." };
  const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  const emails = (input.emails || "")
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    .slice(0, 10);

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const next = { ...current, business_day_cutoff: normalized, z_report_emails: emails };
  const { error } = await supabase.from("businesses").update({ settings: next }).eq("id", business.id);
  if (error) {
    console.error("setDayClose:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
