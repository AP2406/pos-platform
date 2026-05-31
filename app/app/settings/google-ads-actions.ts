"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

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