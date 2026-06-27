"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  createBuyerIdentity,
  createPaymentInstrument,
  createTransfer,
  getFinixConfig,
  isFinixConfigured,
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

type ChargeOk = {
  ok: true;
  transferId: string;
  state: string;
  amountCents: number;
  paymentInstrumentId: string;
  buyerIdentityId: string;
  dbPaymentId: string;
};

type ChargeError = { error: string; details?: unknown };

export async function chargeTestCard(
  input: ChargeInput
): Promise<ChargeOk | ChargeError> {
  await requireBusiness();

  if (!isFinixConfigured()) {
    return { error: "Finix env vars missing." };
  }

  const config = getFinixConfig();
  if (!config.merchantId) {
    return { error: "FINIX_MERCHANT_ID missing in env vars." };
  }

  const amountCents = Math.round(input.amountDollars * 100);
  if (amountCents < 100) {
    return { error: "Minimum charge is $1.00." };
  }

  // 1. Create a buyer Identity (anonymous, just for sandbox testing)
  const [firstName, ...rest] = input.cardholderName.trim().split(/\s+/);
  const lastName = rest.join(" ") || "Test";

  const identityResult = await createBuyerIdentity({
    entity: {
      first_name: firstName || "Test",
      last_name: lastName,
      email: input.buyerEmail,
    },
  });

  if ("error" in identityResult) {
    return { error: `Identity creation failed: ${identityResult.error}`, details: identityResult.details };
  }

  const buyerIdentityId = identityResult.data.id;

  // 2. Create a Payment Instrument (the card) linked to that identity
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
      error: `Card tokenization failed: ${piResult.error}`,
      details: piResult.details,
    };
  }

  const paymentInstrumentId = piResult.data.id;

  // 3. Look up Finix Merchant Identity ID — for now use the Application Owner
  //    identity. When sub-merchant onboarding lands, this becomes the operator's
  //    Finix Identity ID instead.
  const merchantIdentityId = process.env.FINIX_MERCHANT_IDENTITY_ID;
  if (!merchantIdentityId) {
    return {
      error:
        "FINIX_MERCHANT_IDENTITY_ID missing. Add the Merchant Identity ID from the Finix dashboard to .env.local.",
    };
  }

  // 4. Create the Transfer (charge the card, route to merchant identity)
  const idempotencyKey = `surge-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const transferResult = await createTransfer({
    amount: amountCents,
    currency: "USD",
    source: paymentInstrumentId,
    merchant_identity: merchantIdentityId,
    idempotency_id: idempotencyKey,
    tags: {
      source: "surge-debug",
      environment: config.environment,
    },
  });

  if ("error" in transferResult) {
    return {
      error: `Transfer failed: ${transferResult.error}`,
      details: transferResult.details,
    };
  }

  const transfer = transferResult.data;

  // 5. Record in Surge DB (finix_payments writes are service-role only under RLS).
  const { business } = await requireBusiness();
  const admin = createAdminClient();

  const { data: dbRow, error: dbError } = await admin
    .from("finix_payments")
    .insert({
      business_id: business.id,
      trip_id: null,
      finix_transfer_id: transfer.id,
      finix_payment_instrument_id: paymentInstrumentId,
      finix_merchant_id: config.merchantId,
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
    console.error("finix_payments insert:", dbError);
    return {
      error: `Payment succeeded at Finix but failed to record in DB: ${dbError?.message ?? "unknown"}`,
      details: { transferId: transfer.id },
    };
  }

  return {
    ok: true,
    transferId: transfer.id,
    state: transfer.state,
    amountCents: transfer.amount,
    paymentInstrumentId,
    buyerIdentityId,
    dbPaymentId: dbRow.id,
  };
}