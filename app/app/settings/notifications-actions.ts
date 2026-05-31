"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { sendPushToUser } from "@/lib/push";

export async function savePushSubscription(
  subJson: string
): Promise<{ ok: boolean }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sub: any;
  try {
    sub = JSON.parse(subJson);
  } catch {
    return { ok: false };
  }
  if (!sub || !sub.endpoint || !sub.keys) return { ok: false };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      business_id: business.id,
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    console.error("savePushSubscription:", error);
    return { ok: false };
  }
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function sendTestNotification(): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { ok: false, message: "Not signed in." };
  await sendPushToUser(user.id, {
    title: "Surge",
    body: "Push notifications are working.",
    url: "/app",
  });
  return { ok: true, message: "Test sent — check your phone in a moment." };
}