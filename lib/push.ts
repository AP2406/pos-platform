import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const configured = (() => {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(
      "mailto:notifications@surgetechpos.com",
      pub,
      priv
    );
    return true;
  }
  return false;
})();

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  );
}

type Payload = { title: string; body?: string; url?: string };
type SubRow = { endpoint: string; p256dh: string; auth: string };

async function sendToRows(rows: SubRow[], payload: Payload) {
  const sb = admin();
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify(payload)
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", r.endpoint);
        } else {
          console.error("push send error:", code, e?.body);
        }
      }
    })
  );
}

export async function sendPushToUser(userId: string, payload: Payload) {
  if (!configured) return;
  const sb = admin();
  const { data } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (data && data.length) await sendToRows(data as SubRow[], payload);
}

export async function sendPushToBusiness(businessId: string, payload: Payload) {
  if (!configured) return;
  const sb = admin();
  const { data } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("business_id", businessId);
  if (data && data.length) await sendToRows(data as SubRow[], payload);
}

export async function notifyBusiness(
  businessId: string,
  type: string,
  payload: Payload
) {
  if (!configured) return;
  const sb = admin();
  const [{ data: subs }, { data: prefs }] = await Promise.all([
    sb
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .eq("business_id", businessId),
    sb
      .from("notification_preferences")
      .select("user_id, enabled")
      .eq("business_id", businessId)
      .eq("type", type),
  ]);
  if (!subs || !subs.length) return;
  const disabled = new Set(
    (prefs || [])
      .filter((p) => p.enabled === false)
      .map((p) => p.user_id)
  );
  const allowed = subs.filter((s) => !disabled.has(s.user_id));
  if (allowed.length) await sendToRows(allowed as SubRow[], payload);
}