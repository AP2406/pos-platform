"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isFinixConfigured, createBuyerIdentity, finix, resolveMerchantId } from "@/lib/services/finix";
import { createAdminClient } from "@/lib/supabase/admin";

type TokenizedChargeConfig = {
  applicationId: string;
  environment: string;
  merchantId: string | null;
};

export async function getTokenizedChargeConfig(): Promise<TokenizedChargeConfig> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id")
    .eq("id", business.id)
    .single();

  return {
    applicationId: process.env.FINIX_APPLICATION_ID || "",
    environment: process.env.FINIX_ENVIRONMENT === "live" ? "live" : "sandbox",
    merchantId: resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null),
  };
}

type TokenizedChargeInput = {
  amountDollars: number;
  token: string;
  fraudSessionId?: string;
  cardholderName: string;
  buyerEmail?: string;
};

type FinixPaymentInstrumentResp = { id: string; last_four?: string; brand?: string };

type FinixTransferResp = {
  id: string;
  state: string;
  amount: number;
  currency: string;
  failure_code?: string;
  failure_message?: string;
};

type ChargeOk = {
  ok: true;
  transferId: string;
  state: string;
  amountCents: number;
  merchantId: string;
  paymentInstrumentId: string;
  buyerIdentityId: string;
  dbPaymentId: string;
};

type ChargeError = { error: string; details?: unknown };

export async function chargeTokenizedCard(
  input: TokenizedChargeInput
): Promise<ChargeOk | ChargeError> {
  const { business } = await requireBusiness();

  if (!isFinixConfigured()) {
    return { error: "Finix env vars missing." };
  }
  if (!input.token) {
    return { error: "No card token was provided by the browser." };
  }

  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id")
    .eq("id", business.id)
    .single();

  const merchantId = resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null);
  if (!merchantId) {
    return {
      error: "This business has no Finix merchant, and no sandbox FINIX_MERCHANT_ID fallback is set. Onboard at /app/debug/onboard or set FINIX_MERCHANT_ID.",
    };
  }

  const amountCents = Math.round(input.amountDollars * 100);
  if (amountCents < 100) {
    return { error: "Minimum charge is $1.00." };
  }

  const nameParts = input.cardholderName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Test";
  const lastName = nameParts.slice(1).join(" ") || "Customer";

  const identityResult = await createBuyerIdentity({
    entity: { first_name: firstName, last_name: lastName, email: input.buyerEmail },
  });
  if ("error" in identityResult) {
    return {
      error: "Buyer identity failed: " + identityResult.error,
      details: identityResult.details,
    };
  }
  const buyerIdentityId = identityResult.data.id;

  const piResult = await finix.post<FinixPaymentInstrumentResp>("/payment_instruments", {
    type: "TOKEN",
    token: input.token,
    identity: buyerIdentityId,
  });
  if ("error" in piResult) {
    return {
      error: "Token to payment instrument failed: " + piResult.error,
      details: piResult.details,
    };
  }
  const paymentInstrumentId = piResult.data.id;

  const idempotencyId =
    "surge-tokenized-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const transferBody: Record<string, unknown> = {
    amount: amountCents,
    currency: "CAD",
    source: paymentInstrumentId,
    merchant: merchantId,
    idempotency_id: idempotencyId,
    tags: { source: "surge-tokenized" },
  };
  if (input.fraudSessionId) {
    transferBody.fraud_session_id = input.fraudSessionId;
  }

  const transferResult = await finix.post<FinixTransferResp>("/transfers", transferBody);
  if ("error" in transferResult) {
    return {
      error: "Transfer failed: " + transferResult.error,
      details: transferResult.details,
    };
  }
  const transfer = transferResult.data;

  // finix_payments writes are service-role only (RLS: members read-only).
  const admin = createAdminClient();
  const { data: dbRow, error: dbError } = await admin
    .from("finix_payments")
    .insert({
      business_id: business.id,
      trip_id: null,
      finix_transfer_id: transfer.id,
      finix_payment_instrument_id: paymentInstrumentId,
      finix_merchant_id: merchantId,
      amount_cents: transfer.amount,
      currency: transfer.currency,
      status: transfer.state.toLowerCase(),
      failure_code: transfer.failure_code,
      failure_message: transfer.failure_message,
      raw_response: transfer as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (dbError || !dbRow) {
    return {
      error: "Charged at Finix but failed to record: " + (dbError?.message || "unknown"),
      details: { transferId: transfer.id },
    };
  }

  return {
    ok: true,
    transferId: transfer.id,
    state: transfer.state,
    amountCents: transfer.amount,
    merchantId: merchantId,
    paymentInstrumentId: paymentInstrumentId,
    buyerIdentityId: buyerIdentityId,
    dbPaymentId: dbRow.id,
  };
}