"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { sendSms, isSmsConfigured } from "@/lib/services/sms";
import { revalidatePath } from "next/cache";

// P2-34 email marketing + GAP-0 SMS. CASL: only customers who gave express
// consent are ever messaged; email carries an unsubscribe link + sender id, SMS
// carries a STOP opt-out + sender name.

export type Channel = "email" | "sms";
export type MarketingRecipient = { id: string; name: string; email: string | null; phone: string | null; unsubscribe_token: string };

// C7: dynamic segments derived from order history, alongside the existing tag
// segments. These keys are recognised in addition to a raw tag UUID.
export const DYNAMIC_SEGMENTS = ["all", "active", "lapsed", "vip", "loyalty", "new"] as const;
export type DynamicSegment = (typeof DYNAMIC_SEGMENTS)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Consented, emailable customers — narrowed to a segment (a dynamic key or a
// tag UUID). Dynamic segments fetch order/loyalty history for the consented set
// and filter on recency / frequency / value.
async function loadRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  segment: string
): Promise<MarketingRecipient[]> {
  let customerIds: string[] | null = null;
  if (segment && segment !== "all" && UUID_RE.test(segment)) {
    const { data: tagged } = await supabase
      .from("customer_tags")
      .select("customer_id")
      .eq("tag_id", segment);
    customerIds = (tagged ?? []).map((t) => t.customer_id as string);
    if (customerIds.length === 0) return [];
  }

  let q = supabase
    .from("customers")
    .select("id, name, email, phone, unsubscribe_token")
    .eq("business_id", businessId)
    .eq("marketing_consent", true);
  if (customerIds) q = q.in("id", customerIds);

  const { data } = await q;
  let recipients: MarketingRecipient[] = (data ?? [])
    .map((c) => ({
      id: c.id as string,
      name: (c.name as string | null) ?? "",
      email: (c.email as string | null) && (c.email as string).includes("@") ? (c.email as string) : null,
      phone: (c.phone as string | null) || null,
      unsubscribe_token: c.unsubscribe_token as string,
    }))
    .filter((c) => c.email || c.phone); // reachable on at least one channel

  // Dynamic, history-based segments.
  const dyn = segment as DynamicSegment;
  if (recipients.length > 0 && (dyn === "active" || dyn === "lapsed" || dyn === "vip" || dyn === "new" || dyn === "loyalty")) {
    const ids = recipients.map((r) => r.id);
    const now = Date.now();
    if (dyn === "loyalty") {
      const { data: loy } = await supabase
        .from("loyalty_accounts")
        .select("customer_id, points")
        .eq("business_id", businessId)
        .in("customer_id", ids)
        .gt("points", 0);
      const has = new Set((loy ?? []).map((l) => l.customer_id as string));
      recipients = recipients.filter((r) => has.has(r.id));
    } else {
      const { data: ord } = await supabase
        .from("orders")
        .select("customer_id, total, created_at, status")
        .eq("business_id", businessId)
        .neq("status", "voided")
        .in("customer_id", ids)
        .gte("created_at", new Date(now - 365 * 86400000).toISOString());
      const stat = new Map<string, { visits: number; spend: number; firstMs: number; lastMs: number }>();
      for (const o of ord ?? []) {
        const cid = o.customer_id as string;
        const ms = new Date(o.created_at as string).getTime();
        const s = stat.get(cid) ?? { visits: 0, spend: 0, firstMs: Infinity, lastMs: 0 };
        s.visits += 1; s.spend += Number(o.total) || 0;
        if (ms < s.firstMs) s.firstMs = ms;
        if (ms > s.lastMs) s.lastMs = ms;
        stat.set(cid, s);
      }
      if (dyn === "vip") {
        // Top 20% by lifetime spend among the consented set (min spend $1).
        const spends = recipients.map((r) => stat.get(r.id)?.spend ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
        const cut = spends.length > 0 ? spends[Math.floor(spends.length * 0.8)] : Infinity;
        recipients = recipients.filter((r) => (stat.get(r.id)?.spend ?? 0) >= cut && (stat.get(r.id)?.spend ?? 0) > 0);
      } else {
        recipients = recipients.filter((r) => {
          const s = stat.get(r.id);
          if (dyn === "active") return s != null && now - s.lastMs <= 30 * 86400000;
          if (dyn === "lapsed") return s != null && now - s.lastMs > 60 * 86400000;
          if (dyn === "new") return s != null && s.visits <= 2 && now - s.firstMs <= 30 * 86400000;
          return true;
        });
      }
    }
  }

  return recipients;
}

export async function getMarketingAudience(segment?: string | null, channel: Channel = "email"): Promise<{ count: number; configured: boolean; smsConfigured: boolean }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const recipients = await loadRecipients(supabase, business.id, segment || "all");
  const count = recipients.filter((r) => (channel === "sms" ? !!r.phone : !!r.email)).length;
  return { count, configured: channel === "sms" ? isSmsConfigured() : isEmailConfigured(), smsConfigured: isSmsConfigured() };
}

// Set a customer's express marketing consent (owner/manager). Records when and
// where it was captured, as CASL expects.
export async function setMarketingConsent(
  customerId: string,
  consent: boolean
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change consent." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      marketing_consent: consent,
      marketing_consent_at: new Date().toISOString(),
      marketing_consent_source: consent ? "staff" : "staff_optout",
    })
    .eq("id", customerId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setMarketingConsent:", error);
    return { error: "Could not update consent." };
  }
  revalidatePath("/app/customers/" + customerId);
  return { ok: true };
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Send a campaign to the consented segment. Each email carries the business name
// (sender identification) and an unsubscribe link (CASL). A campaign row is
// recorded. Owner/manager only.
export async function sendCampaign(input: {
  subject: string;
  body: string;
  segment?: string | null;
  channel?: Channel;
}): Promise<{ ok: true; sent: number; failed: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can send a campaign." };
  }
  const channel: Channel = input.channel === "sms" ? "sms" : "email";
  if (channel === "email" && !isEmailConfigured()) return { error: "Email isn't configured for this business yet." };
  if (channel === "sms" && !isSmsConfigured()) return { error: "Texting (Twilio) isn't configured for this business yet." };
  const subject = (input.subject || "").trim().slice(0, 200);
  const body = (input.body || "").trim().slice(0, channel === "sms" ? 1000 : 20000);
  if (channel === "email" && !subject) return { error: "Add a subject." };
  if (!body) return { error: "Write a message." };

  const segment = input.segment || "all";
  const supabase = await createClient();
  const all = await loadRecipients(supabase, business.id, segment);
  const recipients = all.filter((r) => (channel === "sms" ? !!r.phone : !!r.email));
  if (recipients.length === 0) return { error: "No consented customers reachable by " + (channel === "sms" ? "text" : "email") + " in that segment." };

  // Public unsubscribe links must always point at the canonical marketing host,
  // never the request host (which could be a vercel.app deployment URL).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.surgetechpos.com";
  const { data: { user } } = await supabase.auth.getUser();

  let sent = 0, failed = 0;
  for (const r of recipients) {
    if (channel === "sms") {
      // CASL: opted-in only; identify the sender + carrier STOP opt-out.
      const text = body + "\n\n— " + business.name + ". Reply STOP to opt out.";
      const res = await sendSms({ to: r.phone as string, body: text });
      if ("ok" in res) sent++; else failed++;
    } else {
      const unsubUrl = origin + "/unsubscribe/" + r.unsubscribe_token;
      const html =
        "<div style=\"font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">" +
        (r.name ? "<p>Hi " + escapeHtml(r.name) + ",</p>" : "") +
        "<div>" + body.replace(/\n/g, "<br>") + "</div>" +
        "<hr style=\"margin:24px 0;border:none;border-top:1px solid #ddd\">" +
        "<p style=\"font-size:12px;color:#666\">You're receiving this because you opted in to updates from " +
        escapeHtml(business.name) + ".<br>" +
        "<a href=\"" + unsubUrl + "\">Unsubscribe</a></p></div>";
      const res = await sendEmail({ to: r.email as string, from: business.name + " <onboarding@resend.dev>", subject, html });
      if ("ok" in res) sent++; else failed++;
    }
  }

  await supabase.from("marketing_campaigns").insert({
    business_id: business.id,
    subject: channel === "sms" ? "[SMS] " + body.slice(0, 60) : subject,
    body,
    segment_tag: UUID_RE.test(segment) ? segment : null, // dynamic segments aren't tags
    recipient_count: sent,
    created_by: user ? user.id : null,
  });

  revalidatePath("/app/marketing");
  return { ok: true, sent, failed };
}
