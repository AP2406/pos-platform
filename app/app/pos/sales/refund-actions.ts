"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

const REASONS = ["customer_request", "defective", "wrong_item", "overcharge", "duplicate", "other"];

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

type RefundLineInput = { order_item_id: string; quantity: number };

type RefundOrderResult = { ok: true; order: { id: string; sale_number: number | null; status: string; subtotal: number; discount: number; tax: number; tip: number; total: number; refunded_amount: number }; lines: { order_item_id: string; name: string; unit_price: number; sold: number; returned: number; returnable: number }[] } | { error: string };

type RefundItemsResult = { ok: true; amount: number; fully: boolean; returned_subtotal: number; discount_portion: number; tax_portion: number } | { error: string };

export async function getOrderForRefund(orderId: string): Promise<RefundOrderResult> {
  if (!orderId) return { error: "Missing sale." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can refund a sale." };
  }
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, sale_number, status, subtotal, discount, tax, tip, total")
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
    },
    lines: lines,
  };
}

export async function refundItems(input: { order_id: string; lines: RefundLineInput[]; reason: string; note?: string; restock: boolean }): Promise<RefundItemsResult> {
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

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, subtotal, discount, tax, total")
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

  const refundLines: { order_item_id: string; name: string; quantity: number; line_subtotal: number }[] = [];
  let returnedSubtotal = 0;
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
  const discountPortion = round2((Number(order.discount) || 0) * f);
  const taxPortion = round2((Number(order.tax) || 0) * f);
  let amount = round2(returnedSubtotal - discountPortion + taxPortion);

  const orderTotal = Number(order.total) || 0;
  const remaining = round2(orderTotal - refundedAmount);
  if (amount > remaining) amount = remaining;
  if (amount < 0) amount = 0;

  let restocked = false;
  if (input.restock) {
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
    type: "partial",
    items: refundLines,
    returned_subtotal: returnedSubtotal,
    discount_portion: discountPortion,
    tax_portion: taxPortion,
    amount: amount,
    reason: input.reason,
    refunded_at: new Date().toISOString(),
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: refundError } = await supabase.from("refunds").insert({
    business_id: business.id,
    order_id: orderId,
    amount: amount,
    reason: input.reason,
    note: input.note && input.note.trim() ? input.note.trim().slice(0, 300) : null,
    status: "recorded",
    restocked: restocked,
    snapshot: snapshot,
    created_by: user ? user.id : null,
  });
  if (refundError) {
    console.error("refundItems insert:", refundError);
    return { error: "Could not record the refund. Please try again." };
  }

  let totalSold = 0;
  let totalReturned = 0;
  for (const id of Object.keys(itemById)) {
    totalSold += itemById[id].quantity;
    const prev = returnedByItem[id] || 0;
    const nowThis = refundLines.filter((l) => l.order_item_id === id).reduce((a, l) => a + l.quantity, 0);
    totalReturned += prev + nowThis;
  }
  const fully = totalSold > 0 && totalReturned >= totalSold;

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
    },
  });
  if (refundAuditError) console.error("refundItems audit:", refundAuditError);

  revalidatePath("/app/pos/sales");
  return { ok: true, amount: amount, fully: fully, returned_subtotal: returnedSubtotal, discount_portion: discountPortion, tax_portion: taxPortion };
}