import { sendEmail, isEmailConfigured } from "./email";

// Owner/manager alert emails. Audience = the Z-report recipients (settings
// .z_report_emails) — the same people who get the day-close summary. Each alert
// type is toggleable via settings.alerts.<key> (default ON). Best-effort.

export function alertRecipients(settings: unknown): string[] {
  const arr = (settings as { z_report_emails?: unknown } | null)?.z_report_emails;
  return Array.isArray(arr) ? arr.filter((e): e is string => typeof e === "string") : [];
}

export function alertEnabled(settings: unknown, key: string): boolean {
  const alerts = (settings as { alerts?: Record<string, unknown> } | null)?.alerts ?? {};
  return alerts[key] !== false; // default on
}

export async function emailOwnerAlert(
  business: { settings?: unknown; name?: string },
  opts: { key: string; subject: string; html: string }
): Promise<void> {
  if (!isEmailConfigured()) return;
  if (!alertEnabled(business.settings, opts.key)) return;
  const recipients = alertRecipients(business.settings);
  if (recipients.length === 0) return;
  for (const to of recipients.slice(0, 10)) {
    const sent = await sendEmail({ to, subject: opts.subject, html: opts.html });
    if ("error" in sent) console.error("emailOwnerAlert:", sent.error);
  }
}
