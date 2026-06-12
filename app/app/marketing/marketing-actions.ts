"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

// P2-34 email marketing. CASL: only customers who gave express consent and have
// an email are ever messaged, and every message carries a working unsubscribe
// link plus sender identification.

export type MarketingRecipient = { id: string; name: string; email: string; unsubscribe_token: string };

// Consented, emailable customers — optionally narrowed to a tag.
async function loadRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  tagId: string | null
): Promise<MarketingRecipient[]> {
  let customerIds: string[] | null = null;
  if (tagId) {
    const { data: tagged } = await supabase
      .from("customer_tags")
      .select("customer_id")
      .eq("tag_id", tagId);
    customerIds = (tagged ?? []).map((t) => t.customer_id as string);
    if (customerIds.length === 0) return [];
  }

  let q = supabase
    .from("customers")
    .select("id, name, email, unsubscribe_token")
    .eq("business_id", businessId)
    .eq("marketing_consent", true)
    .not("email", "is", null);
  if (customerIds) q = q.in("id", customerIds);

  const { data } = await q;
  return (data ?? [])
    .filter((c) => (c.email as string | null) && (c.email as string).includes("@"))
    .map((c) => ({
      id: c.id as string,
      name: (c.name as string | null) ?? "",
      email: c.email as string,
      unsubscribe_token: c.unsubscribe_token as string,
    }));
}

export async function getMarketingAudience(tagId?: string | null): Promise<{ count: number; configured: boolean }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const recipients = await loadRecipients(supabase, business.id, tagId ?? null);
  return { count: recipients.length, configured: isEmailConfigured() };
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
  tagId?: string | null;
}): Promise<{ ok: true; sent: number; failed: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can send a campaign." };
  }
  if (!isEmailConfigured()) return { error: "Email isn't configured for this business yet." };
  const subject = (input.subject || "").trim().slice(0, 200);
  const body = (input.body || "").trim().slice(0, 20000);
  if (!subject) return { error: "Add a subject." };
  if (!body) return { error: "Write a message." };

  const supabase = await createClient();
  const recipients = await loadRecipients(supabase, business.id, input.tagId ?? null);
  if (recipients.length === 0) return { error: "No consented customers in that segment." };

  const hdrs = await headers();
  const origin = "https://" + (hdrs.get("host") ?? "surgetechpos.com");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const unsubUrl = origin + "/unsubscribe/" + r.unsubscribe_token;
    const html =
      "<div style=\"font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111\">" +
      (r.name ? "<p>Hi " + escapeHtml(r.name) + ",</p>" : "") +
      "<div>" + body.replace(/\n/g, "<br>") + "</div>" +
      "<hr style=\"margin:24px 0;border:none;border-top:1px solid #ddd\">" +
      "<p style=\"font-size:12px;color:#666\">You're receiving this because you opted in to updates from " +
      escapeHtml(business.name) + ".<br>" +
      "<a href=\"" + unsubUrl + "\">Unsubscribe</a></p></div>";
    const res = await sendEmail({
      to: r.email,
      from: business.name + " <onboarding@resend.dev>",
      subject,
      html,
    });
    if ("ok" in res) sent++;
    else failed++;
  }

  await supabase.from("marketing_campaigns").insert({
    business_id: business.id,
    subject,
    body,
    segment_tag: input.tagId ?? null,
    recipient_count: sent,
    created_by: user ? user.id : null,
  });

  revalidatePath("/app/marketing");
  return { ok: true, sent, failed };
}
