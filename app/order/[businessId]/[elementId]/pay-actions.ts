"use server";

import { createClient } from "@/lib/supabase/server";
import { isFinixConfigured, createBuyerIdentity, finix, refundTransfer } from "@/lib/services/finix";
import { computeCartTax, type CartTaxConfig } from "@/lib/services/tax-compute";

// GAP-1 (3/5): QR pay-at-table. A guest, on their own phone, pays the open check
// for their table by card. The amount is computed SERVER-SIDE from the live check
// (never trusting the client) via the same tax helper the register uses; the charge
// path mirrors the register's createCardOrder — charge first, then record, and
// reverse the charge if recording fails so money is never kept without a sale.

const UUID = /^[0-9a-fA-F-]{36}$/;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

type CheckItem = { catalog_item_id: string | null; name: string; unit_price: number; quantity: number; taxable: boolean; tax_rate_id: string | null; tax_rate_ids?: string[] | null };

export type GuestCheckView =
  | { ok: true; open: true; cardLive: boolean; businessName: string; tableLabel: string | null; lines: { name: string; qty: number; amount: number }[]; subtotal: number; tax: number; total: number }
  | { ok: true; open: false; cardLive: boolean; businessName: string | null }
  | { error: string };

// Compute the authoritative subtotal/tax/total for a table's open check.
async function loadCheck(businessId: string, elementId: string): Promise<
  | { error: string }
  | { found: false }
  | { found: true; open: false; cardLive: boolean; businessName: string | null }
  | { found: true; open: true; cardLive: boolean; businessName: string; tableLabel: string | null; merchantId: string | null; items: { catalog_item_id: string | null; name: string; unit_price: number; quantity: number; taxable: boolean; tax_rate_ids: string[] }[]; subtotal: number; tax: number; taxBreakdown: { label: string; rate: number; base: number; amount: number }[] }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_check", { p_business_id: businessId, p_element_id: elementId });
  if (error || !data) return { error: "Could not load the check." };
  const d = data as {
    found: boolean; enabled?: boolean; open?: boolean; card_live?: boolean; business_name?: string;
    table_label?: string | null; default_tax_rate?: number; merchant_id?: string | null;
    items?: CheckItem[]; rates?: { id: string; name: string; rate: number }[];
  };
  if (!d.found || d.enabled === false) return { found: false };
  if (!d.open) return { found: true, open: false, cardLive: d.card_live === true, businessName: d.business_name ?? null };

  const items = (d.items ?? []).map((i) => {
    // Multi-tax: prefer the junction ids; fall back to the legacy single rate so
    // this works whether or not the guest-check RPC has been updated (migration 0093).
    const ids = Array.isArray(i.tax_rate_ids) && i.tax_rate_ids.length > 0
      ? i.tax_rate_ids.filter((x): x is string => !!x)
      : (i.tax_rate_id ? [i.tax_rate_id] : []);
    return {
      catalog_item_id: i.catalog_item_id ?? null,
      name: i.name,
      unit_price: Number(i.unit_price) || 0,
      quantity: Number(i.quantity) || 0,
      taxable: i.taxable !== false,
      tax_rate_ids: ids,
    };
  });
  const subtotal = r2(items.reduce((s, i) => s + i.unit_price * i.quantity, 0));

  let defaultRate = Number(d.default_tax_rate) || 0;
  if (defaultRate > 1) defaultRate = defaultRate / 100;
  const cfg: CartTaxConfig = { defaultRateFrac: defaultRate, itemTaxMeta: {}, rateFracById: {}, rateNameById: {} };
  for (const i of items) if (i.catalog_item_id) cfg.itemTaxMeta[i.catalog_item_id] = { taxable: i.taxable, tax_rate_ids: i.tax_rate_ids };
  for (const rr of d.rates ?? []) { cfg.rateFracById[rr.id] = (Number(rr.rate) || 0) / 100; cfg.rateNameById[rr.id] = rr.name; }
  const { tax, taxBreakdown } = computeCartTax(items, cfg, 1);

  return { found: true, open: true, cardLive: d.card_live === true, businessName: d.business_name ?? "", tableLabel: d.table_label ?? null, merchantId: d.merchant_id ?? null, items, subtotal, tax, taxBreakdown };
}

// What the guest's "View check" panel renders.
export async function getGuestCheck(businessId: string, elementId: string): Promise<GuestCheckView> {
  if (!UUID.test(businessId) || !UUID.test(elementId)) return { error: "Invalid link." };
  const res = await loadCheck(businessId, elementId);
  if ("error" in res) return res;
  if (!res.found) return { error: "This table isn't available." };
  if (!res.open) return { ok: true, open: false, cardLive: res.cardLive, businessName: res.businessName };
  const lines = res.items.filter((i) => i.quantity > 0).map((i) => ({ name: i.name, qty: i.quantity, amount: r2(i.unit_price * i.quantity) }));
  return { ok: true, open: true, cardLive: res.cardLive, businessName: res.businessName, tableLabel: res.tableLabel, lines, subtotal: res.subtotal, tax: res.tax, total: r2(res.subtotal + res.tax) };
}

type PayResult = { ok: true; total: number; saleNumber: number | null } | { declined: true; message: string } | { error: string };

// Charge the guest's card for the check total + optional tip, then record the sale.
export async function payGuestCheck(input: {
  businessId: string;
  elementId: string;
  tipCents: number;
  card: { token: string; fraudSessionId?: string; cardholderName?: string; buyerEmail?: string };
}): Promise<PayResult> {
  const { businessId, elementId } = input;
  if (!UUID.test(businessId) || !UUID.test(elementId)) return { error: "Invalid link." };
  if (!input.card?.token) return { error: "No card was entered." };
  if (!isFinixConfigured()) return { error: "Card payments aren't available here. Please pay at the counter." };

  const res = await loadCheck(businessId, elementId);
  if ("error" in res) return res;
  if (!res.found) return { error: "This table isn't available." };
  if (!res.open) return { error: "There's no open check for this table. Please ask your server." };
  if (!res.cardLive || !res.merchantId) return { error: "Card payments aren't available here. Please pay at the counter." };

  const tip = r2(Math.max(0, Math.min(Number(input.tipCents) || 0, 100000) / 100)); // cap tip at $1000
  const total = r2(res.subtotal + res.tax + tip);
  const amountCents = Math.round(total * 100);
  if (amountCents < 100) return { error: "This check is too small to pay by card." };

  // Charge (mirrors the register: identity -> tokenized instrument -> transfer).
  const nameParts = (input.card.cardholderName || "").trim().split(/\s+/).filter(Boolean);
  const identityRes = await createBuyerIdentity({ entity: { first_name: nameParts[0] || "Guest", last_name: nameParts.slice(1).join(" ") || "Diner", email: input.card.buyerEmail } });
  if ("error" in identityRes) return { error: "Could not start the payment. Please try again." };

  const piRes = await finix.post<{ id: string }>("/payment_instruments", { type: "TOKEN", token: input.card.token, identity: identityRes.data.id });
  if ("error" in piRes) return { error: "The card could not be read. Please re-enter it." };
  const instrumentId = piRes.data.id;

  const idem = "guestpay-" + elementId + "-" + String(amountCents);
  const transferBody: Record<string, unknown> = { amount: amountCents, currency: "CAD", source: instrumentId, merchant: res.merchantId, idempotency_id: idem, tags: { source: "surge-qr-pay" } };
  if (input.card.fraudSessionId) transferBody.fraud_session_id = input.card.fraudSessionId;

  const transferRes = await finix.post<{ id: string; state: string; amount: number; failure_message?: string }>("/transfers", transferBody);
  if ("error" in transferRes) return { error: "The payment didn't go through. Please try again." };
  const transfer = transferRes.data;
  if ((transfer.state || "").toUpperCase() !== "SUCCEEDED") {
    return { declined: true, message: transfer.failure_message || "The card was declined. Please try another card." };
  }

  // Charged. Record the sale via settle_guest_check (which reuses create_pos_order).
  // If recording fails, reverse the charge so money is never kept without a sale.
  const supabase = await createClient();
  const { data: settleData, error: settleErr } = await supabase.rpc("settle_guest_check", {
    p_business_id: businessId,
    p_element_id: elementId,
    p_subtotal: res.subtotal,
    p_tax: res.tax,
    p_tip: tip,
    p_total: total,
    p_tax_breakdown: res.taxBreakdown,
    p_transfer_id: transfer.id,
    p_payment_instrument_id: instrumentId,
    p_merchant_id: res.merchantId,
    p_amount_cents: amountCents,
    p_currency: "CAD",
    p_idem: "guestpay:" + transfer.id,
  });
  const settle = (settleData ?? null) as { ok?: boolean; sale_number?: number | string } | null;
  if (settleErr || !settle?.ok) {
    await refundTransfer(transfer.id, { refundAmount: transfer.amount, idempotency_id: "surge-refund-" + transfer.id, tags: { reason: "guest_settle_failed" } });
    return { error: "The card was charged but the order couldn't be saved, so the charge was reversed. Please try again." };
  }
  return { ok: true, total, saleNumber: settle.sale_number != null ? Number(settle.sale_number) : null };
}
