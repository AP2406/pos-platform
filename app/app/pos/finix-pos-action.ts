"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isFinixConfigured, createBuyerIdentity, finix, refundTransfer } from "@/lib/services/finix";
import { createOrder } from "./actions";

type CardConfig =
  | { enabled: true; applicationId: string; environment: string; merchantId: string }
  | { enabled: false; reason: string };

type FinixPiResp = { id: string };

type FinixTransferResp = {
  id: string;
  state: string;
  amount: number;
  currency: string;
  failure_code?: string;
  failure_message?: string;
};

type CardItem = {
  catalog_item_id?: string | null;
  name: string;
  unit_price: number;
  quantity: number;
};

type CreateCardOrderInput = {
  items: CardItem[];
  tip?: number;
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  customer_id?: string | null;
  idempotency_key: string;
  expected_total: number;
  attempt: number;
  card: {
    token: string;
    fraudSessionId?: string;
    cardholderName?: string;
    buyerEmail?: string;
  };
};

type CardOrderResult =
  | { ok: true; id: string; sale_number: number; transferId: string }
  | { declined: true; message: string }
  | { error: string };

// Tells the register whether the card button should open the Finix flow or just
// record a card tender (training mode, or a business that can't take card yet).
export async function getCardConfig(): Promise<CardConfig> {
  const { business } = await requireBusiness();

  if (!isFinixConfigured()) {
    return { enabled: false, reason: "not_configured" };
  }

  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  if (isTraining) {
    return { enabled: false, reason: "training" };
  }

  const supabase = await createClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id, finix_merchant_state")
    .eq("id", business.id)
    .single();

  if (!biz || !biz.finix_merchant_id) {
    return { enabled: false, reason: "not_onboarded" };
  }
  const state = (biz.finix_merchant_state as string | null) || "";
  if (state && state.toUpperCase() !== "APPROVED") {
    return { enabled: false, reason: "not_approved" };
  }

  return {
    enabled: true,
    applicationId: process.env.FINIX_APPLICATION_ID || "",
    environment: process.env.FINIX_ENVIRONMENT === "live" ? "live" : "sandbox",
    merchantId: biz.finix_merchant_id as string,
  };
}

// Charge first, record second. The card is charged into the business's
// sub-merchant; only on SUCCEEDED do we call the existing createOrder to record
// the sale. A decline records nothing (no burned sale number, no inventory hit).
export async function createCardOrder(input: CreateCardOrderInput): Promise<CardOrderResult> {
  const { business } = await requireBusiness();

  if (!isFinixConfigured()) {
    return { error: "Card payments are not configured." };
  }
  if (!input.card || !input.card.token) {
    return { error: "No card was entered." };
  }

  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  if (isTraining) {
    // Practice sales never touch Finix - record like an ordinary card tender.
    const recT = await createOrder({
      items: input.items,
      tip: input.tip,
      payment_method: "card",
      idempotency_key: input.idempotency_key,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      discount_reason_code: input.discount_reason_code,
      discount_reason_note: input.discount_reason_note,
      customer_id: input.customer_id ?? null,
    });
    if ("error" in recT) return { error: recT.error };
    return { ok: true, id: recT.id, sale_number: recT.sale_number, transferId: "" };
  }

  const supabase = await createClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id, finix_merchant_state")
    .eq("id", business.id)
    .single();
  if (!biz || !biz.finix_merchant_id) {
    return { error: "This business isn't set up to accept card payments yet." };
  }
  const state = (biz.finix_merchant_state as string | null) || "";
  if (state && state.toUpperCase() !== "APPROVED") {
    return { error: "This business's card account isn't approved yet." };
  }
  const merchantId = biz.finix_merchant_id as string;

  const amountCents = Math.round((Number(input.expected_total) || 0) * 100);
  if (amountCents < 100) {
    return { error: "Card payments must be at least $1.00." };
  }

  // 1) Buyer identity (Finix needs a name on the payer).
  const nameParts = (input.card.cardholderName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "Card";
  const lastName = nameParts.slice(1).join(" ") || "Customer";
  const identityResult = await createBuyerIdentity({
    entity: { first_name: firstName, last_name: lastName, email: input.card.buyerEmail },
  });
  if ("error" in identityResult) {
    return { error: "Could not start the card payment. Please try again." };
  }
  const buyerIdentityId = identityResult.data.id;

  // 2) One-time token -> payment instrument (raw card never reaches us).
  const piResult = await finix.post<FinixPiResp>("/payment_instruments", {
    type: "TOKEN",
    token: input.card.token,
    identity: buyerIdentityId,
  });
  if ("error" in piResult) {
    return { error: "The card could not be read. Please re-enter it and try again." };
  }
  const paymentInstrumentId = piResult.data.id;

  // 3) Charge into the sub-merchant. The idempotency id is stable across true
  //    network retries of the same attempt, and only changes when the cashier
  //    retries after a definitive decline (see the modal's attempt counter).
  const idempotencyId = "surge-order-" + input.idempotency_key + "-" + String(input.attempt || 1);
  const transferBody: Record<string, unknown> = {
    amount: amountCents,
    currency: "CAD",
    source: paymentInstrumentId,
    merchant: merchantId,
    idempotency_id: idempotencyId,
    tags: { source: "surge-pos" },
  };
  if (input.card.fraudSessionId) {
    transferBody.fraud_session_id = input.card.fraudSessionId;
  }

  const transferResult = await finix.post<FinixTransferResp>("/transfers", transferBody);
  if ("error" in transferResult) {
    // Ambiguous - we don't know if money moved. Record nothing; a retry with the
    // same attempt id de-dupes at Finix.
    return { error: "The payment didn't go through. Please try again." };
  }
  const transfer = transferResult.data;
  const stateUpper = (transfer.state || "").toUpperCase();

  // Record the Finix attempt for audit. Guarded so a retry can't double-insert.
  async function recordFinixPayment(orderId: string | null): Promise<void> {
    const { data: existingFp } = await supabase
      .from("finix_payments")
      .select("id")
      .eq("finix_transfer_id", transfer.id)
      .maybeSingle();
    if (existingFp) {
      if (orderId) {
        await supabase
          .from("finix_payments")
          .update({ order_id: orderId, status: (transfer.state || "").toLowerCase() })
          .eq("id", existingFp.id);
      }
      return;
    }
    await supabase.from("finix_payments").insert({
      business_id: business.id,
      order_id: orderId,
      trip_id: null,
      finix_transfer_id: transfer.id,
      finix_payment_instrument_id: paymentInstrumentId,
      finix_merchant_id: merchantId,
      amount_cents: transfer.amount,
      currency: transfer.currency,
      status: (transfer.state || "").toLowerCase(),
      failure_code: transfer.failure_code,
      failure_message: transfer.failure_message,
      raw_response: transfer as unknown as Record<string, unknown>,
    });
  }

  if (stateUpper !== "SUCCEEDED") {
    // Decline / canceled / failed - no money moved. Record the attempt, create
    // no sale, let the cashier retry.
    await recordFinixPayment(null);
    const msg = transfer.failure_message || "The card was declined. Try another card or payment method.";
    return { declined: true, message: msg };
  }

  // 4) Charge succeeded -> record the sale through the untouched createOrder.
  const rec = await createOrder({
    items: input.items,
    tip: input.tip,
    payment_method: "card",
    idempotency_key: input.idempotency_key,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    discount_reason_code: input.discount_reason_code,
    discount_reason_note: input.discount_reason_note,
    customer_id: input.customer_id ?? null,
  });

  if ("error" in rec) {
    // Charged but couldn't save the sale - reverse so the customer isn't out of
    // pocket, then ask the cashier to retry.
    await refundTransfer(transfer.id, {
      refundAmount: transfer.amount,
      idempotency_id: "surge-refund-" + transfer.id,
      tags: { reason: "order_record_failed" },
    });
    await recordFinixPayment(null);
    return { error: "The card was charged but the sale couldn't be saved, so the charge was reversed. Please try again." };
  }

  // 5) Safety net: the amount charged must equal the recorded sale total. The
  //    client total is built to match the server, so a mismatch is rare (e.g. a
  //    tax rate changed mid-session). If it ever happens, reverse rather than
  //    keep a wrong amount on the books.
  const { data: savedOrder } = await supabase
    .from("orders")
    .select("total")
    .eq("id", rec.id)
    .eq("business_id", business.id)
    .single();
  const savedCents = savedOrder ? Math.round((Number(savedOrder.total) || 0) * 100) : amountCents;
  if (savedCents !== amountCents) {
    console.error("createCardOrder amount mismatch: charged " + amountCents + " vs sale total " + savedCents + " (order " + rec.id + ")");
    await refundTransfer(transfer.id, {
      refundAmount: transfer.amount,
      idempotency_id: "surge-refund-" + transfer.id,
      tags: { reason: "amount_mismatch" },
    });
    await supabase.from("orders").update({ status: "voided" }).eq("id", rec.id).eq("business_id", business.id);
    await recordFinixPayment(null);
    return { error: "The price changed during checkout, so the charge was reversed. Please ring the sale up again." };
  }

  await recordFinixPayment(rec.id);
  return { ok: true, id: rec.id, sale_number: rec.sale_number, transferId: transfer.id };
}