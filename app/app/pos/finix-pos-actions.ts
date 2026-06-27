"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isFinixConfigured, createBuyerIdentity, finix, refundTransfer, resolveMerchantId, finixErrorMessage } from "@/lib/services/finix";
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
  tax_exempt?: boolean;
  tax_exempt_reason_code?: string;
  tax_exempt_reason_note?: string;
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

export async function getCardConfig(): Promise<CardConfig> {
  const { business } = await requireBusiness();

  // Demo/sandbox businesses never process real money.
  if ((business as { is_demo?: boolean }).is_demo) {
    return { enabled: false, reason: "demo" };
  }

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

  // Resolve the merchant: the business's own, else the sandbox env fallback so a
  // test business can charge in sandbox without per-business onboarding.
  const merchantId = resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null);
  if (!merchantId) {
    return { enabled: false, reason: "not_onboarded" };
  }
  // Only require APPROVED when the business has its own merchant; the sandbox
  // fallback merchant has no per-business state to check.
  if (biz?.finix_merchant_id) {
    const state = (biz.finix_merchant_state as string | null) || "";
    if (state && state.toUpperCase() !== "APPROVED") {
      return { enabled: false, reason: "not_approved" };
    }
  }

  return {
    enabled: true,
    applicationId: process.env.FINIX_APPLICATION_ID || "",
    // Finix.js expects "sandbox" | "live" — must match the SDK's accepted values.
    environment: process.env.FINIX_ENVIRONMENT === "live" ? "live" : "sandbox",
    merchantId,
  };
}

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
    const recT = await createOrder({
      items: input.items,
      tip: input.tip,
      payment_method: "card",
      idempotency_key: input.idempotency_key,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      discount_reason_code: input.discount_reason_code,
      discount_reason_note: input.discount_reason_note,
      tax_exempt: input.tax_exempt,
      tax_exempt_reason_code: input.tax_exempt_reason_code,
      tax_exempt_reason_note: input.tax_exempt_reason_note,
      customer_id: input.customer_id ?? null,
    });
    if ("error" in recT) return { error: recT.error };
    return { ok: true, id: recT.id, sale_number: recT.sale_number, transferId: "" };
  }

  const supabase = await createClient();

  // Double-charge guard. If a prior attempt for this same order key already
  // placed the sale AND captured a (non-failed) transfer, return that result
  // instead of charging again. This covers the case where a success response
  // was lost and the cashier reopened the card modal to retry: the modal's
  // attempt counter resets on remount, so its Finix idempotency_id would
  // differ and Finix would not dedupe -- but the order already exists here.
  {
    const { data: priorOrder } = await supabase
      .from("orders")
      .select("id, sale_number")
      .eq("business_id", business.id)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (priorOrder) {
      const { data: priorPay } = await supabase
        .from("finix_payments")
        .select("finix_transfer_id, status")
        .eq("business_id", business.id)
        .eq("order_id", priorOrder.id)
        .not("finix_transfer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const priorState = priorPay ? String(priorPay.status || "").toLowerCase() : "";
      const priorCaptured =
        !!priorPay && priorState !== "failed" && priorState !== "canceled" && priorState !== "cancelled";
      if (priorCaptured) {
        return {
          ok: true,
          id: priorOrder.id as string,
          sale_number: Number(priorOrder.sale_number),
          transferId: (priorPay.finix_transfer_id as string) || "",
        };
      }
    }
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id, finix_merchant_state")
    .eq("id", business.id)
    .single();
  // Business's own merchant, else the sandbox env fallback (same resolution as
  // getCardConfig so the charge matches what the register offered).
  const merchantId = resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null);
  if (!merchantId) {
    return { error: "This business isn't set up to accept card payments yet." };
  }
  if (biz?.finix_merchant_id) {
    const state = (biz.finix_merchant_state as string | null) || "";
    if (state && state.toUpperCase() !== "APPROVED") {
      return { error: "This business's card account isn't approved yet." };
    }
  }

  const amountCents = Math.round((Number(input.expected_total) || 0) * 100);
  if (amountCents < 100) {
    return { error: "Card payments must be at least $1.00." };
  }

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

  const piResult = await finix.post<FinixPiResp>("/payment_instruments", {
    type: "TOKEN",
    token: input.card.token,
    identity: buyerIdentityId,
  });
  if ("error" in piResult) {
    return { error: "The card could not be read. Please re-enter it and try again." };
  }
  const paymentInstrumentId = piResult.data.id;

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
    // Surface the real Finix reason (e.g. MAX_TRANSACTION_AMOUNT_EXCEEDED) rather
    // than a generic message — declines arrive as an HTTP error with the detail.
    const { message } = finixErrorMessage(transferResult);
    if (message) return { declined: true, message };
    return { error: "The payment didn't go through. Please try again." };
  }
  const transfer = transferResult.data;
  const stateUpper = (transfer.state || "").toUpperCase();

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
    await recordFinixPayment(null);
    const msg = transfer.failure_message || "The card was declined. Try another card or payment method.";
    return { declined: true, message: msg };
  }

  // Charge succeeded. Record the sale. If recording fails for ANY reason
  // (returned error OR thrown exception), reverse the charge so we never
  // keep money without a matching sale.
  let rec: Awaited<ReturnType<typeof createOrder>>;
  try {
    rec = await createOrder({
      items: input.items,
      tip: input.tip,
      payment_method: "card",
      idempotency_key: input.idempotency_key,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      discount_reason_code: input.discount_reason_code,
      discount_reason_note: input.discount_reason_note,
      tax_exempt: input.tax_exempt,
      tax_exempt_reason_code: input.tax_exempt_reason_code,
      tax_exempt_reason_note: input.tax_exempt_reason_note,
      customer_id: input.customer_id ?? null,
    });
  } catch (e) {
    console.error("createCardOrder: createOrder threw after successful charge " + transfer.id, e);
    await refundTransfer(transfer.id, {
      refundAmount: transfer.amount,
      idempotency_id: "surge-refund-" + transfer.id,
      tags: { reason: "order_record_exception" },
    });
    await recordFinixPayment(null);
    return { error: "The card was charged but the sale couldn't be saved, so the charge was reversed. Please try again." };
  }

  if ("error" in rec) {
    await refundTransfer(transfer.id, {
      refundAmount: transfer.amount,
      idempotency_id: "surge-refund-" + transfer.id,
      tags: { reason: "order_record_failed" },
    });
    await recordFinixPayment(null);
    return { error: "The card was charged but the sale couldn't be saved, so the charge was reversed. Please try again." };
  }

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