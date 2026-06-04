"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isFinixConfigured } from "@/lib/services/finix";
import {
  createMerchantIdentity,
  provisionMerchant,
} from "@/lib/services/finix-onboarding";
import type { CreateMerchantIdentityInput } from "@/lib/services/finix-onboarding";

type OnboardOk = {
  ok: true;
  identityId: string;
  merchantId: string;
  state: string;
};

type OnboardError = { error: string; details?: unknown };

export async function onboardCurrentBusiness(
  input: CreateMerchantIdentityInput
): Promise<OnboardOk | OnboardError> {
  const { business } = await requireBusiness();

  if (!isFinixConfigured()) {
    return { error: "Finix env vars missing." };
  }

  const identityResult = await createMerchantIdentity(input);
  if ("error" in identityResult) {
    return {
      error: "Merchant identity creation failed: " + identityResult.error,
      details: identityResult.details,
    };
  }
  const identityId = identityResult.data.id;

  const merchantResult = await provisionMerchant(identityId, {
    business_id: business.id,
  });
  if ("error" in merchantResult) {
    return {
      error: "Merchant provisioning failed: " + merchantResult.error,
      details: merchantResult.details,
    };
  }
  const merchant = merchantResult.data;
  const state = merchant.onboarding_state || "PROVISIONING";

  const supabase = await createClient();
  const { error: dbError } = await supabase
    .from("businesses")
    .update({
      finix_identity_id: identityId,
      finix_merchant_id: merchant.id,
      finix_merchant_state: state,
      finix_onboarded_at: new Date().toISOString(),
    })
    .eq("id", business.id);

  if (dbError) {
    return {
      error: "Onboarded at Finix but failed to save to DB: " + (dbError.message || "unknown"),
      details: { identityId: identityId, merchantId: merchant.id },
    };
  }

  return {
    ok: true,
    identityId: identityId,
    merchantId: merchant.id,
    state: state,
  };
}