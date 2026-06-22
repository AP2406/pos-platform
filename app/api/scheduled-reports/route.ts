import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { primeCostSummary } from "@/app/app/accounting/cost";

export const dynamic = "force-dynamic";

// C8: scheduled owner report. Daily cron (vercel.json — Hobby allows daily). For
// each business with settings.scheduled_report.enabled, email a sales/labor/
// prime-cost digest: daily covers the prior 24h, weekly the prior 7 days and
// only fires on the configured weekday (business tz). Idempotent per day via
// last_sent. Protected by CRON_SECRET when configured.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(r2(n));
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const { data: bizRows } = await supabase
    .from("businesses")
    .select("id, name, currency, timezone, settings")
    .limit(1000);

  let sent = 0;
  for (const biz of bizRows ?? []) {
    const settings = ((biz.settings ?? {}) as Record<string, unknown>);
    const cfg = (settings.scheduled_report ?? {}) as { enabled?: boolean; frequency?: string; weekday?: number; recipients?: unknown; last_sent?: string };
    if (cfg.enabled !== true) continue;

    const tz = (biz.timezone as string) || "America/Toronto";
    const currency = ((biz.currency as string) || "USD").toUpperCase();
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
    if (cfg.last_sent === todayKey) continue; // already sent today

    const weekly = cfg.frequency === "weekly";
    if (weekly) {
      const todayDow = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(now));
      const want = DOW[Math.min(6, Math.max(0, Number(cfg.weekday) || 0))];
      if (todayDow !== want) continue; // not this business's weekly send day
    }

    const days = weekly ? 7 : 1;
    const startIso = new Date(now - days * 86400000).toISOString();

    // Recipients: explicit list, else fall back to z_report emails.
    let recipients = Array.isArray(cfg.recipients) ? (cfg.recipients as unknown[]).filter((e): e is string => typeof e === "string") : [];
    if (recipients.length === 0) {
      const z = settings.z_report_emails;
      recipients = Array.isArray(z) ? (z as unknown[]).filter((e): e is string => typeof e === "string") : [];
    }
    if (recipients.length === 0) continue;

    // Sales: paid, non-voided orders in window; net of refunds. Pre-tax subtotal
    // is the cost-ratio base.
    const [{ data: orders }, { data: refunds }] = await Promise.all([
      supabase.from("orders").select("total, subtotal, status").eq("business_id", biz.id).eq("status", "paid").neq("status", "voided").gte("created_at", startIso).lt("created_at", nowIso),
      supabase.from("refunds").select("amount, status").eq("business_id", biz.id).neq("status", "voided").gte("created_at", startIso).lt("created_at", nowIso),
    ]);
    const gross = (orders ?? []).reduce((s, o) => s + (Number(o.total) || 0), 0);
    const salesBase = (orders ?? []).reduce((s, o) => s + (Number(o.subtotal) || 0), 0);
    const count = (orders ?? []).length;
    const refundTotal = (refunds ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const net = r2(gross - refundTotal);
    const avgCheck = count > 0 ? r2(gross / count) : 0;

    const prime = await primeCostSummary(
      supabase as unknown as Parameters<typeof primeCostSummary>[0],
      biz.id as string,
      startIso,
      nowIso,
      salesBase
    );

    const periodLabel = weekly ? "Last 7 days" : "Yesterday";
    const html =
      `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">` +
      `<h2 style="margin:0 0 4px">${biz.name as string}</h2>` +
      `<p style="color:#666;margin:0 0 16px">${periodLabel} · ${new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(now))}</p>` +
      `<table style="width:100%;border-collapse:collapse;font-size:14px">` +
      row("Net sales", fmt(net, currency)) +
      row("Orders", String(count)) +
      row("Avg check", fmt(avgCheck, currency)) +
      (refundTotal > 0 ? row("Refunds", fmt(refundTotal, currency)) : "") +
      row("Food cost", `${fmt(prime.cogs, currency)}${prime.foodCostPct != null ? ` &middot; ${prime.foodCostPct}%` : ""}`) +
      row("Labor", `${fmt(prime.laborCost, currency)}${prime.laborPct != null ? ` &middot; ${prime.laborPct}%` : ""}`) +
      row("Prime cost", `${fmt(prime.primeCost, currency)}${prime.primeCostPct != null ? ` &middot; ${prime.primeCostPct}%` : ""}`) +
      `</table>` +
      (prime.coveragePct != null && prime.coveragePct < 90 ? `<p style="color:#999;font-size:12px;margin-top:12px">Food cost covers ${prime.coveragePct}% of sales by recipe — add recipes for a fuller figure.</p>` : "") +
      `</div>`;

    const res = await sendEmail({ to: recipients.join(", "), subject: `${biz.name as string} — ${periodLabel.toLowerCase()} report`, html });
    if (!("error" in res)) {
      await supabase
        .from("businesses")
        .update({ settings: { ...settings, scheduled_report: { ...cfg, last_sent: todayKey } } })
        .eq("id", biz.id as string);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;color:#666">${label}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${value}</td></tr>`;
}
