"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  isFinixConfigured,
  createBuyerIdentity,
  finix,
  refundTransfer,
  resolveMerchantId,
  finixErrorMessage,
  createAuthorization,
  captureAuthorization,
  voidAuthorization,
  type FinixAuthorization,
} from "@/lib/services/finix";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder } from "./actions";
import { type CanonicalOrderInput, forwardOrderFields } from "@/lib/pos/canonical-order";

// Card-not-present pre-auth for BAR TABS (card-present PAX auth is deferred until the
// device operation_key is confirmed). Three steps:
//   authorizeTabCard  — hold the card at tab open, stored on the open_ticket
//   captureTab        — at close, capture the hold (tip included) up to the hold, record the sale
//   voidTabAuthorization — release the hold on a walked/cancelled tab
// Same money-safety as the sale path: the capture is the "charge"; if recording the
// sale then fails, the capture is reversed so money is never kept without a sale.
//
// GATE: verify the full auth→capture→void round-trip against a Finix SANDBOX before
// this goes near a live card (the capture endpoint especially — see lib/services/finix.ts).

type PreauthResult = { ok: true } | { declined: true; message: string } | { error: string };
type CaptureResult = { ok: true; id: string; sale_number: number } | { declined: true; message: string } | { error: string };

async function resolveBusinessMerchant(): Promise<{ merchantId: string } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("finix_merchant_id, finix_merchant_state")
    .eq("id", business.id)
    .single();
  const merchantId = resolveMerchantId((biz?.finix_merchant_id as string | null) ?? null);
  if (!merchantId) return { error: "This business isn't set up to accept card payments yet." };
  if (biz?.finix_merchant_id) {
    const state = (biz.finix_merchant_state as string | null) || "";
    if (state && state.toUpperCase() !== "APPROVED") return { error: "This business's card account isn't approved yet." };
  }
  return { merchantId };
}

// Place a hold on a card and attach it to a bar tab (open_ticket).
export async function authorizeTabCard(input: {
  ticket_id: string;
  hold_amount: number; // dollars
  card: { token: string; fraudSessionId?: string; cardholderName?: string; buyerEmail?: string };
}): Promise<PreauthResult> {
  if (!input.ticket_id) return { error: "Missing tab." };
  if (!input.card?.token) return { error: "No card was entered." };
  if (!isFinixConfigured()) return { error: "Card payments aren't available here." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  // The tab must be an open bar tab for this business.
  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, finix_authorization_id, finix_auth_state")
    .eq("id", input.ticket_id)
    .eq("business_id", business.id)
    .eq("ticket_type", "tab")
    .maybeSingle();
  if (!ticket) return { error: "Tab not found." };
  if (ticket.finix_authorization_id && (ticket.finix_auth_state as string) === "held") {
    return { error: "This tab already has a card hold." };
  }

  const holdCents = Math.round((Number(input.hold_amount) || 0) * 100);
  if (holdCents < 100) return { error: "The hold must be at least $1.00." };
  if (holdCents > 100_000_000) return { error: "That hold is too large." };

  const merch = await resolveBusinessMerchant();
  if ("error" in merch) return { error: merch.error };

  const nameParts = (input.card.cardholderName || "").trim().split(/\s+/).filter(Boolean);
  const identityRes = await createBuyerIdentity({
    entity: { first_name: nameParts[0] || "Card", last_name: nameParts.slice(1).join(" ") || "Customer", email: input.card.buyerEmail },
  });
  if ("error" in identityRes) return { error: "Could not start the card hold. Please try again." };

  const piRes = await finix.post<{ id: string }>("/payment_instruments", { type: "TOKEN", token: input.card.token, identity: identityRes.data.id });
  if ("error" in piRes) return { error: "The card could not be read. Please re-enter it." };
  const instrumentId = piRes.data.id;

  const authRes = await createAuthorization({
    amount: holdCents,
    currency: "CAD",
    source: instrumentId,
    merchant: merch.merchantId,
    idempotency_id: "surge-tabauth-" + input.ticket_id,
    fraud_session_id: input.card.fraudSessionId,
    tags: { source: "surge-bar-tab", ticket_id: input.ticket_id },
  });
  if ("error" in authRes) {
    const { message } = finixErrorMessage(authRes);
    if (message) return { declined: true, message };
    return { error: "The card hold didn't go through. Please try again." };
  }
  const auth = authRes.data;
  if ((auth.state || "").toUpperCase() !== "SUCCEEDED") {
    return { declined: true, message: auth.failure_message || "The card was declined. Try another card." };
  }

  const { error: upErr } = await supabase
    .from("open_tickets")
    .update({
      finix_authorization_id: auth.id,
      finix_auth_amount_cents: auth.amount,
      finix_auth_instrument_id: instrumentId,
      finix_auth_merchant_id: merch.merchantId,
      finix_auth_expires_at: auth.expires_at ?? null,
      finix_auth_state: "held",
    })
    .eq("id", input.ticket_id)
    .eq("business_id", business.id);
  if (upErr) {
    // Couldn't attach the hold to the tab — release it so a hold never dangles.
    await voidAuthorization(auth.id, "surge-tabvoid-" + input.ticket_id);
    console.error("authorizeTabCard: attach failed, hold voided", upErr);
    return { error: "Could not save the card hold. Please try again." };
  }
  return { ok: true };
}

// Capture a tab's hold for the final total (tip included) and record the sale.
export async function captureTab(
  input: CanonicalOrderInput & { ticket_id: string; expected_total: number }
): Promise<CaptureResult> {
  if (!input.ticket_id) return { error: "Missing tab." };
  if (!isFinixConfigured()) return { error: "Card payments aren't available here." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, finix_authorization_id, finix_auth_amount_cents, finix_auth_instrument_id, finix_auth_state")
    .eq("id", input.ticket_id)
    .eq("business_id", business.id)
    .eq("ticket_type", "tab")
    .maybeSingle();
  if (!ticket || !ticket.finix_authorization_id) return { error: "This tab has no card hold to charge." };
  if ((ticket.finix_auth_state as string) !== "held") return { error: "This tab's hold was already settled or released." };

  const authId = ticket.finix_authorization_id as string;
  const authCents = Number(ticket.finix_auth_amount_cents) || 0;
  const finalCents = Math.round((Number(input.expected_total) || 0) * 100);
  if (finalCents < 100) return { error: "The tab total is too small to charge." };
  // Safe v1: the hold must cover the tab. If it doesn't, the cashier takes the
  // remainder as a separate tender (or re-pre-auths a higher hold).
  if (finalCents > authCents) {
    return { error: "The card hold ($" + (authCents / 100).toFixed(2) + ") doesn't cover the tab ($" + (finalCents / 100).toFixed(2) + "). Take the difference as another payment or place a higher hold." };
  }

  const capRes = await captureAuthorization(authId, finalCents, "surge-tabcap-" + input.ticket_id);
  if ("error" in capRes) {
    const { message } = finixErrorMessage(capRes);
    if (message) return { declined: true, message };
    return { error: "The card capture didn't go through. Please try again." };
  }
  const captured: FinixAuthorization = capRes.data;
  const transferId = captured.transfer;
  if ((captured.state || "").toUpperCase() === "FAILED" || !transferId) {
    return { declined: true, message: captured.failure_message || "The card was declined at capture. Try another payment." };
  }

  // Record the sale. If recording fails, reverse the captured transfer so money is
  // never kept without a matching sale (mirrors createCardOrder).
  let rec: Awaited<ReturnType<typeof createOrder>>;
  try {
    rec = await createOrder({ ...forwardOrderFields(input), payment_method: "card", open_ticket_id: input.ticket_id });
  } catch (e) {
    console.error("captureTab: createOrder threw after capture " + transferId, e);
    await refundTransfer(transferId, { refundAmount: captured.amount, idempotency_id: "surge-tabrev-" + transferId, tags: { reason: "tab_record_exception" } });
    return { error: "The card was charged but the sale couldn't be saved, so the charge was reversed. Please try again." };
  }
  if ("error" in rec) {
    await refundTransfer(transferId, { refundAmount: captured.amount, idempotency_id: "surge-tabrev-" + transferId, tags: { reason: "tab_record_failed" } });
    return { error: "The card was charged but the sale couldn't be saved, so the charge was reversed. Please try again." };
  }

  // Amount guard: the recorded sale must equal what we captured.
  const { data: savedOrder } = await supabase.from("orders").select("total").eq("id", rec.id).eq("business_id", business.id).single();
  const savedCents = savedOrder ? Math.round((Number(savedOrder.total) || 0) * 100) : finalCents;
  if (savedCents !== finalCents) {
    console.error("captureTab amount mismatch: captured " + finalCents + " vs sale " + savedCents + " (order " + rec.id + ")");
    await refundTransfer(transferId, { refundAmount: captured.amount, idempotency_id: "surge-tabrev-" + transferId, tags: { reason: "tab_amount_mismatch" } });
    return { error: "The tab total changed during checkout, so the charge was reversed. Please ring it again." };
  }

  // Link the finix payment (service-role) and mark the hold captured.
  const admin = createAdminClient();
  const { data: existingFp } = await admin.from("finix_payments").select("id").eq("finix_transfer_id", transferId).maybeSingle();
  if (!existingFp) {
    await admin.from("finix_payments").insert({
      business_id: business.id,
      order_id: rec.id,
      finix_transfer_id: transferId,
      finix_payment_instrument_id: ticket.finix_auth_instrument_id,
      finix_merchant_id: null,
      amount_cents: captured.amount,
      currency: captured.currency,
      status: "succeeded",
      raw_response: captured as unknown as Record<string, unknown>,
    });
  } else {
    await admin.from("finix_payments").update({ order_id: rec.id, status: "succeeded" }).eq("id", existingFp.id);
  }
  await supabase.from("open_tickets").update({ finix_auth_state: "captured" }).eq("id", input.ticket_id).eq("business_id", business.id);

  return { ok: true, id: rec.id, sale_number: rec.sale_number };
}

// Release a tab's hold (walked / cancelled tab).
export async function voidTabAuthorization(ticketId: string): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing tab." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("finix_authorization_id, finix_auth_state")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .eq("ticket_type", "tab")
    .maybeSingle();
  if (!ticket || !ticket.finix_authorization_id) return { error: "This tab has no card hold." };
  if ((ticket.finix_auth_state as string) !== "held") return { error: "This tab's hold was already settled or released." };

  const res = await voidAuthorization(ticket.finix_authorization_id as string, "surge-tabvoid-" + ticketId);
  if ("error" in res) return { error: "Could not release the card hold. Please try again." };
  await supabase.from("open_tickets").update({ finix_auth_state: "voided" }).eq("id", ticketId).eq("business_id", business.id);
  return { ok: true };
}
