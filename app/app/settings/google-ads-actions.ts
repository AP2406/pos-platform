"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { GoogleAdsApi } from "google-ads-api";

export async function getGoogleAdsStatus(): Promise<{
  connected: boolean;
  customerId: string | null;
  loginCustomerId: string | null;
  lastSyncedAt: string | null;
}> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("google_ads_connections")
    .select("refresh_token, customer_id, login_customer_id, last_synced_at")
    .eq("business_id", business.id)
    .maybeSingle();
  return {
    connected: !!(data && data.refresh_token),
    customerId: data?.customer_id ?? null,
    loginCustomerId: data?.login_customer_id ?? null,
    lastSyncedAt: data?.last_synced_at ?? null,
  };
}

export async function saveGoogleAdsAccount(
  customerId: string,
  loginCustomerId: string
): Promise<{ ok: boolean }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  const { error } = await supabase.from("google_ads_connections").upsert(
    {
      business_id: business.id,
      customer_id: digits(customerId) || null,
      login_customer_id: digits(loginCustomerId) || null,
    },
    { onConflict: "business_id" }
  );
  if (error) {
    console.error("saveGoogleAdsAccount:", error);
    return { ok: false };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function disconnectGoogleAds(): Promise<{ ok: boolean }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  await supabase
    .from("google_ads_connections")
    .delete()
    .eq("business_id", business.id);
  revalidatePath("/app/settings");
  return { ok: true };
}
export async function syncGoogleAdsSpend(): Promise<{
  ok: boolean;
  message: string;
}> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: conn } = await supabase
    .from("google_ads_connections")
    .select("refresh_token, customer_id, login_customer_id")
    .eq("business_id", business.id)
    .maybeSingle();

  if (!conn || !conn.refresh_token) {
    return { ok: false, message: "Connect Google Ads first." };
  }
  if (!conn.customer_id) {
    return { ok: false, message: "Enter your Customer ID and Save account first." };
  }
  if (
    !process.env.GOOGLE_ADS_CLIENT_ID ||
    !process.env.GOOGLE_ADS_CLIENT_SECRET ||
    !process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  ) {
    return { ok: false, message: "Google Ads isn't fully configured." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    const customer = client.Customer({
      customer_id: conn.customer_id,
      refresh_token: conn.refresh_token,
      login_customer_id: conn.login_customer_id || undefined,
    });
    rows = await customer.query(
      "SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date DURING LAST_30_DAYS"
    );
  } catch (e) {
    console.error("google-ads sync:", e);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    const detail =
      err?.errors?.[0]?.message || err?.message || String(e);
    return { ok: false, message: "Google Ads error: " + detail };
  }

  const byDate: Record<string, number> = {};
  for (const r of rows) {
    const d = r?.segments?.date;
    const micros = Number(r?.metrics?.cost_micros ?? 0);
    if (!d) continue;
    byDate[d] = (byDate[d] || 0) + micros / 1000000;
  }

  const since = new Date(Date.now() - 31 * 86400000)
    .toISOString()
    .slice(0, 10);

  await supabase
    .from("expenses")
    .delete()
    .eq("business_id", business.id)
    .eq("source", "google_ads")
    .gte("incurred_on", since);

  const toInsert = Object.entries(byDate)
    .filter(([, amt]) => amt > 0)
    .map(([date, amt]) => ({
      business_id: business.id,
      amount: Math.round(amt * 100) / 100,
      category: "Marketing",
      subcategory: "Google Ads",
      description: "Auto-synced from Google Ads",
      incurred_on: date,
      source: "google_ads",
    }));

  if (toInsert.length) {
    const { error } = await supabase.from("expenses").insert(toInsert);
    if (error) {
      console.error("google-ads expense insert:", error);
      return { ok: false, message: "Couldn't save the spend." };
    }
  }

  await supabase
    .from("google_ads_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("business_id", business.id);

  revalidatePath("/app/profit");
  revalidatePath("/app/settings");

  const total = toInsert.reduce((s, e) => s + e.amount, 0);
  return {
    ok: true,
    message: "Synced " + toInsert.length + " days, " + total.toFixed(2) + " total.",
  };
}