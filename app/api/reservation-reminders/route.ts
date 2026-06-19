import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";

export const dynamic = "force-dynamic";

// Hourly cron (vercel.json): email a reminder for upcoming bookings that have an
// email and haven't been reminded, when they fall within the business's reminder
// window (settings.reservation_reminder_hours, default 3h). Best-effort + idempotent
// via reminded_at. Protected by CRON_SECRET when configured.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ ok: true, sent: 0, note: "email not configured" });

  const supabase = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const horizonIso = new Date(now + 6 * 3600000).toISOString(); // generous upper bound; per-business window applied below

  const { data: rows } = await supabase
    .from("reservations")
    .select("id, guest_name, party_size, email, scheduled_at, business:businesses(name, timezone, settings)")
    .eq("status", "booked")
    .not("email", "is", null)
    .is("reminded_at", null)
    .gte("scheduled_at", nowIso)
    .lte("scheduled_at", horizonIso)
    .limit(200);

  let sent = 0;
  for (const r of rows ?? []) {
    const biz = (Array.isArray(r.business) ? r.business[0] : r.business) as { name?: string; timezone?: string; settings?: Record<string, unknown> } | null;
    const hours = Number(biz?.settings?.reservation_reminder_hours);
    const windowH = Number.isFinite(hours) && hours > 0 ? hours : 3;
    const at = new Date(r.scheduled_at as string).getTime();
    if (at > now + windowH * 3600000) continue; // not yet inside this business's reminder window

    const tz = biz?.timezone || "America/Toronto";
    const when = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(r.scheduled_at as string));
    const name = biz?.name || "the restaurant";
    const res = await sendEmail({
      to: r.email as string,
      subject: `Reminder: your table at ${name}`,
      html: `<p>Hi ${r.guest_name},</p><p>Just a reminder of your reservation for <strong>${r.party_size}</strong> at <strong>${name}</strong> — <strong>${when}</strong>. See you soon!</p>`,
    });
    if (!("error" in res)) {
      await supabase.from("reservations").update({ reminded_at: nowIso }).eq("id", r.id as string);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}
