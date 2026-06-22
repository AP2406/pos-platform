"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// C8: scheduled owner report. Stored on businesses.settings.scheduled_report
// { enabled, frequency: 'daily'|'weekly', weekday: 0..6, recipients[] }. A daily
// cron (/api/scheduled-reports) emails a sales/labor/prime-cost digest; weekly
// sends only on the chosen weekday. Recipients fall back to z_report_emails.
export async function setScheduledReport(input: {
  enabled: boolean;
  frequency: "daily" | "weekly";
  weekday: number;
  recipients: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }

  const frequency = input.frequency === "weekly" ? "weekly" : "daily";
  const weekday = Math.min(6, Math.max(0, Math.round(Number(input.weekday) || 0)));
  const recipients = (input.recipients || "")
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    .slice(0, 10);

  if (input.enabled && recipients.length === 0) {
    return { error: "Add at least one valid recipient email (or it falls back to your Z-report emails)." };
  }

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const next = {
    ...current,
    scheduled_report: { enabled: !!input.enabled, frequency, weekday, recipients },
  };
  const { error } = await supabase.from("businesses").update({ settings: next }).eq("id", business.id);
  if (error) {
    console.error("setScheduledReport:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
