"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  isFinixConfigured,
  createBuyerIdentity,
  createPaymentInstrument,
  finix,
} from "@/lib/services/finix";

type ChargeInput = {
  amountDollars: number;
  cardNumber: string;
  cardExpMonth: number;
  cardExpYear: number;
  cardCvv: string;
  cardholderName: string;
  buyerEmail?: string;
};

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

export async function chargeIntoSubMerchant(
  input: ChargeInput
): Promise<ChargeOk | ChargeError> {
  const { business } = await requireBusiness();

  if (!isFinixConfigured()) {
    return { error: "Finix env vars missing." };
  }

  const supabase = await createClient();

  const { data: biz, error: bizErr } = await supabase
    .from("businesses")
    .select("finix_merchant_id")
    .eq("id", business.id)
    .single();

  if (bizErr || !biz || !biz.finix_merchant_id) {
    return {
      error: "This business has no Finix merchant yet. Onboard it first at /app/debug/onboard.",
    };
  }

  const merchantId = biz.finix_merchant_id as string;

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

  const piResult = await createPaymentInstrument({
    identity: buyerIdentityId,
    type: "PAYMENT_CARD",
    name: input.cardholderName,
    number: input.cardNumber.replace(/\s+/g, ""),
    expiration_month: input.cardExpMonth,
    expiration_year: input.cardExpYear,
    security_code: input.cardCvv,
  });
  if ("error" in piResult) {
    return {
      error: "Card tokenization failed: " + piResult.error,
      details: piResult.details,
    };
  }
  const paymentInstrumentId = piResult.data.id;

  const idempotencyId =
    "surge-submerchant-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const transferResult = await finix.post<FinixTransferResp>("/transfers", {
    amount: amountCents,
    currency: "CAD",
    source: paymentInstrumentId,
    merchant: merchantId,
    idempotency_id: idempotencyId,
    tags: { source: "surge-submerchant-debug" },
  });
  if ("error" in transferResult) {
    return {
      error: "Transfer failed: " + transferResult.error,
      details: transferResult.details,
    };
  }
  const transfer = transferResult.data;

  const { data: dbRow, error: dbError } = await supabase
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