"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P2-31 loyalty configuration. `earnPerDollar` points accrue per $1 of net
// (pre-tax, post-discount) spend; `redeemPerDollar` points buy $1 of discount.
export type LoyaltySettings = {
  enabled: boolean;
  earnPerDollar: number;
  redeemPerDollar: number;
};

const DEFAULTS: LoyaltySettings = { enabled: false, earnPerDollar: 1, redeemPerDollar: 100 };

function sanitizeLoyalty(raw: unknown): LoyaltySettings {
  const s = (raw ?? {}) as Partial<LoyaltySettings>;
  let earn = Number(s.earnPerDollar);
  if (!Number.isFinite(earn) || earn < 0) earn = DEFAULTS.earnPerDollar;
  if (earn > 1000) earn = 1000;
  let redeem = Number(s.redeemPerDollar);
  if (!Number.isFinite(redeem) || redeem <= 0) redeem = DEFAULTS.redeemPerDollar;
  if (redeem > 100000) redeem = 100000;
  return { enabled: s.enabled === true, earnPerDollar: earn, redeemPerDollar: redeem };
}

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("loyalty_settings")
    .eq("id", business.id)
    .maybeSingle();
  return sanitizeLoyalty(data?.loyalty_settings ?? DEFAULTS);
}

export async function saveLoyaltySettings(
  input: LoyaltySettings
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change loyalty." };
  }
  const clean = sanitizeLoyalty(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ loyalty_settings: clean })
    .eq("id", business.id);
  if (error) {
    console.error("saveLoyaltySettings:", error);
    return { error: "Could not save loyalty settings." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

// Current points balance for a customer (0 if no account yet).
export async function getLoyaltyBalance(customerId: string): Promise<number> {
  if (!customerId) return 0;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("loyalty_accounts")
    .select("points")
    .eq("business_id", business.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  return data ? (data.points as number) : 0;
}
