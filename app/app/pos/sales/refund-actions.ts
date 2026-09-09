"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { approverByPin } from "@/lib/services/permissions-server";
import { posAuthorize } from "@/lib/services/pos-action-guard";
import { requiresApproval } from "@/lib/services/config/approval";
import { refundTransfer } from "@/lib/services/finix";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { readActiveStaffId, ACTIVE_STAFF_COOKIE } from "@/lib/services/active-staff-cookie";

const REASONS = ["customer_request", "defective", "wrong_item", "overcharge", "duplicate", "other"];

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Resolve the PIN-identified operator on this device (if any).
async function getActiveStaffRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<{ id: string; name: string; role: string } | null> {
  const cookieStore = await cookies();
  const sid = readActiveStaffId(cookieStore.get(ACTIVE_STAFF_COOKIE)?.value, businessId);
  if (!sid) return null;
  const { data } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", sid)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
}

type RefundLineInput = { order_item_id: string; quantity: number };

type RefundOrderResult = { ok: true; order: { id: string; sale_number: number | null; status: string; subtotal: number; discount: number; tax: number; tip: number; total: number; refunded_amount: number; has_customer: boolean }; lines: { order_item_id: string; name: string; unit_price: number; sold: number; returned: number; returnable: number }[] } | { error: string };

type RefundItemsResult = { ok: true; refund_id: string | null; amount: number; fully: boolean; returned_subtotal: number; discount_portion: number; tax_portion: number; card_refunded: number; store_credited: number; house_account_reversed: number; cash_back: number } | { needs_approval: true } | { error: string };

export async function getOrderForRefund(orderId: string): Promise<RefundOrderResult> {
  if (!orderId) return { error: "Missing sale." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can refund a sale." };
  }
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, sale_number, status, subtotal, discount, tax, tip, total, customer_id")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { error: "Sale not found." };
  if (order.status === "voided") return { error: "This sale was voided, not paid." };
  if (order.status === "refunded") return { error: "This sale is already fully refunded." };

  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, unit_price, quantity")
    .eq("order_id", orderId)
    .eq("business_id", business.id);

  const { data: refundRows } = await supabase
    .from("refunds")
    .select("amount, snapshot")
    .eq("order_id", orderId)
    .eq("business_id", business.id);

  const returnedByItem: Record<string, number> = {};
  let refundedAmount = 0;
  for (const r of refundRows ?? []) {
    refundedAmount += Number(r.amount) || 0;
    const snap = r.snapshot as { items?: { order_item_id?: string; quantity?: number }[] } | null;
    const snapItems = snap && Array.isArray(snap.items) ? snap.items : [];
    for (const si of snapItems) {
      const id = si.order_item_id;
      if (id) returnedByItem[id] = (returnedByItem[id] || 0) + (Number(si.quantity) || 0);
    }
  }

  const lines = (items ?? []).map((it) => {
    const sold = Number(it.quantity) || 0;
    const returned = returnedByItem[it.id as string] || 0;
    return {
      order_item_id: it.id as string,
      name: it.name as string,
      unit_price: Number(it.unit_price) || 0,
      sold: sold,
      returned: returned,
      returnable: Math.max(0, sold - returned),
    };
  });

  return {
    ok: true,
    order: {
      id: order.id as string,
      sale_number: order.sale_number != null ? Number(order.sale_number) : null,
      status: (order.status as string) || "paid",
      subtotal: Number(order.subtotal) || 0,
      discount: Number(order.discount) || 0,
      tax: Number(order.tax) || 0,
      tip: Number(order.tip) || 0,
      total: Number(order.total) || 0,
      refunded_amount: round2(refundedAmount),
      has_customer: !!(order.customer_id as string | null),
    },
    lines: lines,
  };
}

// `amount` (dollars) switches to a by-amount refund — an arbitrary figure not tied to
// line items (goodwill, a disputed charge, a tip). When present, `lines`/`restock` are
// ignored and the amount is capped at what's left on the sale. Otherwise the refund is
// by item (the `lines` path).
export async function refundItems(input: { order_id: string; lines: RefundLineInput[]; reason: string; note?: string; restock: boolean; approver_pin?: string; to_store_credit?: boolean; amount?: number; idempotency_key?: string }): Promise<RefundItemsResult> {
 try {
  const orderId = input.order_id;
  if (!orderId) return { error: "Missing sale." };
  if (!input.reason || !REASONS.includes(input.reason)) {
    return { error: "Choose a refund reason." };
  }

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can refund a sale." };
  }
  const supabase = await createClient();

  // The active operator needs the `refund` permission; otherwise a staff member
  // who holds it must approve by PIN. Behavior-preserving with the default
  // matrix (server/host need a manager; manager/owner don't).
  const active = await getActiveStaffRow(supabase, business.id);
  let approver: { id: string; name: string } | null = null;
  const auth = await posAuthorize(supabase, business.id, role, "refund");
  if (!auth.ok) return { error: auth.error };
  if (auth.needsApproval) {
    // CUST-1 approval matrix: default mode requires a manager (today); an owner
    // can set mode 'none' to drop the requirement. (Threshold wiring is later.)
    const { mode } = await requiresApproval("refund", null);
    if (mode !== "none") {
      if (!input.approver_pin) return { needs_approval: true };
      approver = await approverByPin(supabase, business.id, input.approver_pin, "refund");
      if (!approver) return { error: "That PIN can't approve a refund." };
    }
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, subtotal, discount, tax, total, customer_id, payment_method")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { error: "Sale not found." };
  if (order.status === "voided") return { error: "This sale was voided, not paid." };
  if (order.status === "refunded") return { error: "This sale is already fully refunded." };

  const { data: items } = await supabase
    .from("order_items")
    .select("id, name, unit_price, quantity, catalog_item_id")
    .eq("order_id", orderId)
    .eq("business_id", business.id);

  const { data: refundRows } = await supabase
    .from("refunds")
    .select("amount, snapshot")
    .eq("order_id", orderId)
    .eq("business_id", business.id);

  const itemById: Record<string, { name: string; unit_price: number; quantity: number; catalog_item_id: string | null }> = {};
  for (const it of items ?? []) {
    itemById[it.id as string] = {
      name: it.name as string,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 0,
      catalog_item_id: (it.catalog_item_id as string | null) ?? null,
    };
  }

  const returnedByItem: Record<string, number> = {};
  let refundedAmount = 0;
  for (const r of refundRows ?? []) {
    refundedAmount += Number(r.amount) || 0;
    const snap = r.snapshot as { items?: { order_item_id?: string; quantity?: number }[] } | null;
    const snapItems = snap && Array.isArray(snap.items) ? snap.items : [];
    for (const si of snapItems) {
      const id = si.order_item_id;
      if (id) returnedByItem[id] = (returnedByItem[id] || 0) + (Number(si.quantity) || 0);
    }
  }

  const orderTotal = Number(order.total) || 0;
  const remaining = round2(orderTotal - refundedAmount);
  const isAmountMode = input.amount != null;

  const refundLines: { order_item_id: string; name: string; quantity: number; line_subtotal: number }[] = [];
  let returnedSubtotal = 0;
  let discountPortion = 0;
  let taxPortion = 0;
  let amount = 0;

  if (isAmountMode) {
    // By-amount: refund an arbitrary dollar figure, capped at what's left on the sale
    // so it can never over-refund. No line items are returned (nothing to restock).
    amount = round2(Number(input.amount) || 0);
    if (amount <= 0) return { error: "Enter an amount to refund." };
    if (remaining <= 0) return { error: "This sale is already fully refunded." };
    if (amount > remaining) return { error: "That's more than the $" + remaining.toFixed(2) + " left on this sale." };
  } else {
    for (const reqLine of input.lines ?? []) {
      const qty = Math.floor(Number(reqLine.quantity) || 0);
      if (qty <= 0) continue;
      const it = itemById[reqLine.order_item_id];
      if (!it) return { error: "An item on this sale could not be found." };
      const already = returnedByItem[reqLine.order_item_id] || 0;
      const returnable = it.quantity - already;
      if (qty > returnable) {
        return { error: "You cannot return more of " + it.name + " than were sold." };
      }
      const lineSub = round2(it.unit_price * qty);
      returnedSubtotal += lineSub;
      refundLines.push({ order_item_id: reqLine.order_item_id, name: it.name, quantity: qty, line_subtotal: lineSub });
    }
    if (refundLines.length === 0) return { error: "Select at least one item to return." };

    returnedSubtotal = round2(returnedSubtotal);

    const orderSubtotal = Number(order.subtotal) || 0;
    const f = orderSubtotal > 0 ? returnedSubtotal / orderSubtotal : 0;
    discountPortion = round2((Number(order.discount) || 0) * f);
    taxPortion = round2((Number(order.tax) || 0) * f);
    amount = round2(returnedSubtotal - discountPortion + taxPortion);
    if (amount > remaining) amount = remaining;
    if (amount < 0) amount = 0;
  }

  // P2-33b: refund to store credit instead of the original tender. The refund
  // amount becomes spendable store credit for the sale's customer; no money goes
  // back to the card. Requires a customer on the sale.
  const toStoreCredit = input.to_store_credit === true && amount > 0;
  const orderCustomerId = (order.customer_id as string | null) ?? null;
  if (toStoreCredit && !orderCustomerId) {
    return { error: "This sale has no customer, so it can't be refunded to store credit." };
  }
  let storeCreditedCents = 0;

  // --- Idempotency claim (P2-37 review): claim this refund BEFORE any money moves, so a
  // double-submit or two operators refunding the same sale can't pay twice (store-credit
  // has no processor dedup). The unique index on (business_id, idempotency_key) makes the
  // claim atomic. Fully backward-compatible: with no key, or before migration 0095 is
  // applied (column missing), we skip the claim and record once at the end as before.
  const {
    data: { user: refundUser },
  } = await supabase.auth.getUser();
  const idem = input.idempotency_key && /^[0-9a-fA-F-]{10,64}$/.test(input.idempotency_key) ? input.idempotency_key : null;
  let claimId: string | null = null;
  {
    // Claim finalized=false (status stays a known-good 'recorded' to avoid any CHECK on
    // status). Two guards catch a double refund: the order-inflight unique index blocks a
    // CONCURRENT second refund of this sale, and the idempotency-key index blocks a NETWORK
    // RETRY of this same refund after it completed.
    const { data: claim, error: claimErr } = await supabase
      .from("refunds")
      .insert({ business_id: business.id, order_id: orderId, amount: amount, reason: input.reason, status: "recorded", finalized: false, idempotency_key: idem, created_by: refundUser ? refundUser.id : null })
      .select("id")
      .single();
    if (claimErr) {
      if ((claimErr as { code?: string }).code === "23505") {
        // A same-key row ⇒ this exact refund was already submitted (network retry): return
        // the completed one if it finished, else report it in flight. No same-key row ⇒ the
        // conflict is the order-inflight index (a DIFFERENT refund of this sale is running).
        const { data: existing } = idem ? await supabase.from("refunds").select("id, amount, finalized").eq("business_id", business.id).eq("idempotency_key", idem).maybeSingle() : { data: null };
        if (existing) {
          if (existing.finalized === true) {
            const amt = Number(existing.amount) || amount;
            return { ok: true, refund_id: existing.id as string, amount: amt, fully: false, returned_subtotal: 0, discount_portion: 0, tax_portion: 0, card_refunded: 0, store_credited: 0, house_account_reversed: 0, cash_back: 0 };
          }
          return { error: "This refund was already submitted." };
        }
        return { error: "Another refund for this sale is being processed. Please wait a moment and try again." };
      }
      // Column missing (pre-migration) or other error: degrade to the no-claim path so
      // refunds keep working; we just lose the concurrency guard until 0095 is applied.
      console.warn("refundItems: idempotency claim skipped:", claimErr);
    } else {
      claimId = (claim?.id as string | null) ?? null;
    }
  }
  async function abortClaim() {
    if (claimId) await supabase.from("refunds").delete().eq("id", claimId).eq("business_id", business.id);
  }

  // --- Card refund: reverse the original Finix transfer(s) for this sale. ---
  // This MUST happen before we record anything, so a processor failure leaves
  // the books untouched. Cash/other sales have no Finix transfer and skip this.
  // Skipped entirely for a store-credit refund (the money stays with the
  // merchant as a credit).
  let finixReversedCents = 0;
  const finixReversals: { transfer_id: string; reversal_id: string; cents: number; state: string }[] = [];

  if (amount > 0 && !toStoreCredit) {
    const { data: cardPayments } = await supabase
      .from("finix_payments")
      .select("finix_transfer_id, amount_cents, status")
      .eq("order_id", orderId)
      .eq("business_id", business.id)
      .eq("status", "succeeded");

    const succeededTransfers = (cardPayments ?? []).filter(function (p) {
      return p.finix_transfer_id && Number(p.amount_cents) > 0;
    });

    if (succeededTransfers.length > 0) {
      // How much has already been reversed against each transfer in prior refunds.
      const reversedByTransfer: Record<string, number> = {};
      for (const r of refundRows ?? []) {
        const snap = r.snapshot as { finix?: { reversals?: { transfer_id?: string; cents?: number }[] } } | null;
        const prior = snap && snap.finix && Array.isArray(snap.finix.reversals) ? snap.finix.reversals : [];
        for (const pr of prior) {
          if (pr.transfer_id) reversedByTransfer[pr.transfer_id] = (reversedByTransfer[pr.transfer_id] || 0) + (Number(pr.cents) || 0);
        }
      }

      let remainingToReverse = Math.round(amount * 100);
      for (const t of succeededTransfers) {
        if (remainingToReverse <= 0) break;
        const transferId = t.finix_transfer_id as string;
        const chargedCents = Math.round(Number(t.amount_cents) || 0);
        const alreadyReversed = reversedByTransfer[transferId] || 0;
        const reversibleOnThis = Math.max(0, chargedCents - alreadyReversed);
        if (reversibleOnThis <= 0) continue;
        const reverseCents = Math.min(remainingToReverse, reversibleOnThis);
        if (reverseCents <= 0) continue;

        const targetCumulative = alreadyReversed + reverseCents;
        const reversalResult = await refundTransfer(transferId, {
          refundAmount: reverseCents,
          idempotency_id: "surge-cust-refund-" + transferId + "-" + String(targetCumulative),
          tags: { reason: "pos_refund", order_id: orderId },
        });
        if ("error" in reversalResult) {
          console.error("refundItems Finix reversal failed for transfer " + transferId, reversalResult);
          await abortClaim();
          return { error: "The card refund could not be sent to the processor, so nothing was changed. Please try again." };
        }
        const rev = reversalResult.data;
        const revState = (rev.state || "").toUpperCase();
        if (revState === "FAILED" || revState === "CANCELED") {
          console.error("refundItems Finix reversal returned " + revState + " for transfer " + transferId);
          await abortClaim();
          return { error: "The card refund was rejected by the processor, so nothing was changed. Please try again." };
        }
        finixReversals.push({ transfer_id: transferId, reversal_id: rev.id, cents: reverseCents, state: rev.state || "" });
        finixReversedCents += reverseCents;
        remainingToReverse -= reverseCents;
      }
    }
  }

  // Issue the store credit before recording the refund row, so a failure here
  // leaves the books untouched (mirrors the Finix-before-record rule).
  if (toStoreCredit && orderCustomerId) {
    const { error: scErr } = await supabase.rpc("apply_store_credit_delta", {
      p_business_id: business.id,
      p_customer_id: orderCustomerId,
      p_delta_cents: Math.round(amount * 100),
      p_kind: "refund",
      p_order_id: orderId,
    });
    if (scErr) {
      console.error("refundItems store credit:", scErr);
      await abortClaim();
      return { error: "Could not issue the store credit, so nothing was changed. Please try again." };
    }
    storeCreditedCents = Math.round(amount * 100);
  }

  // House account (AR): refunding an order that was charged to a customer's house
  // account reduces what they owe (never below zero). Done before the refund row —
  // same "reverse-before-record" rule as store credit — so a failure changes nothing.
  let houseAccountReversedCents = 0;
  if (!toStoreCredit && order.payment_method === "house_account" && orderCustomerId) {
    const { data: ha } = await supabase
      .from("house_accounts")
      .select("balance_cents")
      .eq("business_id", business.id)
      .eq("customer_id", orderCustomerId)
      .maybeSingle();
    const bal = ha ? (Number(ha.balance_cents) || 0) : 0;
    const reverseCents = Math.min(Math.round(amount * 100), bal);
    if (reverseCents > 0) {
      const { error: haErr } = await supabase.rpc("apply_house_account_delta", {
        p_business_id: business.id,
        p_customer_id: orderCustomerId,
        p_delta_cents: -reverseCents,
        p_kind: "adjust",
        p_order_id: orderId,
        p_note: "refund",
      });
      if (haErr) {
        console.error("refundItems house account reversal:", haErr);
        await abortClaim();
        return { error: "Could not adjust the house account, so nothing was changed. Please try again." };
      }
      houseAccountReversedCents = reverseCents;
    }
  }

  let restocked = false;
  if (input.restock && !isAmountMode) {
    const qtyByItem: Record<string, number> = {};
    for (const rl of refundLines) {
      const cid = itemById[rl.order_item_id].catalog_item_id;
      if (cid) qtyByItem[cid] = (qtyByItem[cid] || 0) + rl.quantity;
    }
    for (const cid of Object.keys(qtyByItem)) {
      const { data: ci } = await supabase
        .from("catalog_items")
        .select("id, track_inventory")
        .eq("id", cid)
        .eq("business_id", business.id)
        .maybeSingle();
      if (ci && ci.track_inventory) {
        const { error: invError } = await supabase.rpc("apply_inventory_change", {
          p_business_id: business.id,
          p_item_id: cid,
          p_change: qtyByItem[cid],
          p_reason: "return",
          p_note: null,
          p_order_id: orderId,
        });
        if (invError) console.error("refund restock:", invError);
        else restocked = true;
      }
    }
  }

  const snapshot = {
    type: isAmountMode ? "amount" : "partial",
    items: refundLines,
    returned_subtotal: returnedSubtotal,
    discount_portion: discountPortion,
    tax_portion: taxPortion,
    amount: amount,
    method: toStoreCredit ? "store_credit" : houseAccountReversedCents > 0 ? "house_account" : null,
    store_credit: toStoreCredit ? { cents: storeCreditedCents, customer_id: orderCustomerId } : null,
    house_account: houseAccountReversedCents > 0 ? { cents: houseAccountReversedCents, customer_id: orderCustomerId } : null,
    finix: finixReversals.length > 0 ? { reversed_cents: finixReversedCents, reversals: finixReversals } : null,
    reason: input.reason,
    staff: active ? { id: active.id, name: active.name, role: active.role } : null,
    approver: approver ? { id: approver.id, name: approver.name } : null,
    refunded_at: new Date().toISOString(),
  };

  // Cash leaves the drawer now, so attribute this refund to the open session
  // (if any) for the end-of-day count.
  const { data: openDrawer } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  const refundDrawerSessionId = openDrawer ? (openDrawer.id as string) : null;

  const user = refundUser;
  const noteVal = input.note && input.note.trim() ? input.note.trim().slice(0, 300) : null;

  // Finalize: if we claimed a row up front, update it to 'recorded' (money already moved
  // under that claim); otherwise record a fresh row (no-idempotency path).
  let refundRow: { id: string } | null = null;
  let refundError: { message?: string } | null = null;
  if (claimId) {
    const { error } = await supabase
      .from("refunds")
      .update({ note: noteVal, status: "recorded", finalized: true, restocked: restocked, snapshot: snapshot, drawer_session_id: refundDrawerSessionId })
      .eq("id", claimId)
      .eq("business_id", business.id);
    refundError = error;
    if (!error) refundRow = { id: claimId };
  } else {
    const { data, error } = await supabase.from("refunds").insert({
      business_id: business.id,
      order_id: orderId,
      amount: amount,
      reason: input.reason,
      note: noteVal,
      status: "recorded",
      restocked: restocked,
      snapshot: snapshot,
      drawer_session_id: refundDrawerSessionId,
      created_by: user ? user.id : null,
    }).select("id").single();
    refundRow = data;
    refundError = error;
  }
  if (refundError) {
    // If the card was already reversed at Finix but this row failed to write,
    // the money DID go back to the customer; this needs manual reconciliation.
    if (finixReversedCents > 0) {
      console.error("refundItems: Finix reversal of " + finixReversedCents + " cents SUCCEEDED but refund row failed to save (order " + orderId + "). Reconcile manually.", refundError);
    } else if (storeCreditedCents > 0) {
      console.error("refundItems: store credit of " + storeCreditedCents + " cents was ISSUED but the refund row failed to save (order " + orderId + "). Reconcile manually.", refundError);
    } else {
      console.error("refundItems insert:", refundError);
    }
    return { error: "Could not record the refund. Please try again." };
  }

  // "Fully refunded" is amount-based: fully once the cumulative refunded amount reaches
  // the order total (within a cent). This (vs the old item-COUNT rule) keeps a tipped
  // sale 'partially_refunded' after an all-items refund so the tip can still be refunded
  // by amount. But a NO-tip sale whose every item is returned can land a cent short of
  // total from proportional tax/discount rounding — so also treat "all items returned and
  // nothing but items was owed" as fully, or it would be stuck 'partially_refunded'.
  let fully = round2(refundedAmount + amount) + 0.005 >= orderTotal;
  if (!fully && !isAmountMode) {
    let totalSold = 0;
    let totalReturned = 0;
    for (const id of Object.keys(itemById)) {
      totalSold += itemById[id].quantity;
      const prev = returnedByItem[id] || 0;
      const nowThis = refundLines.filter((l) => l.order_item_id === id).reduce((a, l) => a + l.quantity, 0);
      totalReturned += prev + nowThis;
    }
    const allItemsReturned = totalSold > 0 && totalReturned >= totalSold;
    // Non-item remainder (tip + service charge). ≤ a cent ⇒ only items were owed.
    const nonItemOwed = round2(orderTotal - ((Number(order.subtotal) || 0) - (Number(order.discount) || 0) + (Number(order.tax) || 0)));
    if (allItemsReturned && nonItemOwed <= 0.005) fully = true;
  }

  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: fully ? "refunded" : "partially_refunded" })
    .eq("id", orderId)
    .eq("business_id", business.id);
  if (statusError) console.error("refundItems status:", statusError);

  // Log the refund to the shared sensitive-actions trail. The refund is already
  // recorded, so a failed audit write is logged, not surfaced.
  const { error: refundAuditError } = await supabase.from("audit_events").insert({
    business_id: business.id,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: "refund",
    order_id: orderId,
    reason_code: input.reason,
    reason_note: input.note && input.note.trim() ? input.note.trim().slice(0, 500) : null,
    metadata: {
      amount: amount,
      returned_subtotal: returnedSubtotal,
      discount_portion: discountPortion,
      tax_portion: taxPortion,
      restocked: restocked,
      fully: fully,
      line_count: refundLines.length,
      card_reversed_cents: finixReversedCents,
      staff_id: active ? active.id : null,
      staff_name: active ? active.name : null,
      approved_by: approver ? approver.id : null,
      approver_name: approver ? approver.name : null,
    },
  });
  if (refundAuditError) console.error("refundItems audit:", refundAuditError);

  revalidatePath("/app/pos/sales");
  // What the automatic reversals covered, and the remainder the cashier must return by
  // hand (cash from the drawer): e.g. a card that only covered part of a split-tender
  // sale, or a house account whose balance was below the refund. Store-credit refunds
  // leave no cash back (the money stayed as a credit).
  const autoReturnedCents = finixReversedCents + storeCreditedCents + houseAccountReversedCents;
  const cashBack = toStoreCredit ? 0 : Math.max(0, round2(amount - autoReturnedCents / 100));
  return { ok: true, refund_id: (refundRow?.id as string | null) ?? null, amount: amount, fully: fully, returned_subtotal: returnedSubtotal, discount_portion: discountPortion, tax_portion: taxPortion, card_refunded: round2(finixReversedCents / 100), store_credited: round2(storeCreditedCents / 100), house_account_reversed: round2(houseAccountReversedCents / 100), cash_back: cashBack };
 } catch (e) {
  // Surface unexpected server errors as a returned error (Next masks thrown server
  // action exceptions in prod, which is what made the refund fail silently).
  console.error("refundItems unexpected:", e);
  return { error: "Couldn't record the refund — " + (e instanceof Error ? e.message : "unexpected error") + ". Please try again." };
 }
}