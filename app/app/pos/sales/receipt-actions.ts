"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";

function money(n: number): string {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const REFUND_REASON_LABELS: Record<string, string> = {
  customer_request: "Customer request",
  defective: "Defective / damaged",
  wrong_item: "Wrong item",
  overcharge: "Overcharge",
  duplicate: "Duplicate charge",
  other: "Other",
};

type OrderForEmail = {
  sale_number: number | null;
  snapshot: unknown;
  total: number;
  created_at: string;
};

function buildReceiptHtml(businessName: string, order: OrderForEmail): string {
  const snap =
    (order.snapshot as {
      items?: { name: string; unit_price: number; quantity: number }[];
      subtotal?: number;
      discount?: { amount?: number };
      tax?: { amount?: number };
      tip?: number;
      total?: number;
      note?: string;
    } | null) || {};

  const items = Array.isArray(snap.items) ? snap.items : [];
  const orderNote = typeof snap.note === "string" ? snap.note.trim() : "";
  const subtotal = typeof snap.subtotal === "number" ? snap.subtotal : 0;
  const discount = snap.discount && typeof snap.discount.amount === "number" ? snap.discount.amount : 0;
  const tax = snap.tax && typeof snap.tax.amount === "number" ? snap.tax.amount : 0;
  const tip = typeof snap.tip === "number" ? snap.tip : 0;
  const total = typeof snap.total === "number" ? snap.total : Number(order.total) || 0;

  const rows = items
    .map(function (l) {
      return (
        '<tr><td style="padding:4px 0">' +
        esc(l.name) +
        " x" +
        l.quantity +
        '</td><td style="padding:4px 0;text-align:right">' +
        money(l.unit_price * l.quantity) +
        "</td></tr>"
      );
    })
    .join("");

  const discountRow =
    discount > 0
      ? '<tr><td>Discount</td><td style="text-align:right">-' + money(discount) + "</td></tr>"
      : "";

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">' +
    '<h2 style="text-align:center;margin:0 0 4px">' +
    esc(businessName) +
    "</h2>" +
    (order.sale_number != null
      ? '<div style="text-align:center;font-weight:bold">Sale #' + order.sale_number + "</div>"
      : "") +
    '<div style="text-align:center;color:#666;font-size:12px;margin-bottom:12px">' +
    esc(new Date(order.created_at).toLocaleString()) +
    "</div>" +
    (orderNote
      ? '<div style="text-align:center;color:#666;font-size:12px;margin-bottom:12px">Note: ' + esc(orderNote) + "</div>"
      : "") +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    rows +
    "</table>" +
    '<hr style="border:none;border-top:1px solid #ddd;margin:10px 0" />' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    '<tr><td>Subtotal</td><td style="text-align:right">' +
    money(subtotal) +
    "</td></tr>" +
    discountRow +
    '<tr><td>Tax</td><td style="text-align:right">' +
    money(tax) +
    "</td></tr>" +
    '<tr><td>Tip</td><td style="text-align:right">' +
    money(tip) +
    "</td></tr>" +
    '<tr><td style="font-weight:bold;padding-top:6px">Total</td><td style="text-align:right;font-weight:bold;padding-top:6px">' +
    money(total) +
    "</td></tr>" +
    "</table>" +
    '<p style="text-align:center;color:#666;font-size:12px;margin-top:16px">Thank you!</p>' +
    "</div>"
  );
}

type RefundForEmail = {
  sale_number: number | null;
  refunded_at: string;
  fully: boolean;
  reason: string;
  items: { name: string; quantity: number; line_subtotal: number }[];
  returned_subtotal: number;
  discount_portion: number;
  tax_portion: number;
  amount: number;
};

function buildRefundReceiptHtml(businessName: string, refund: RefundForEmail): string {
  const reasonLabel = REFUND_REASON_LABELS[refund.reason] || refund.reason;

  const rows = refund.items
    .map(function (l) {
      return (
        '<tr><td style="padding:4px 0">' +
        esc(l.name) +
        " x" +
        l.quantity +
        '</td><td style="padding:4px 0;text-align:right">' +
        money(l.line_subtotal) +
        "</td></tr>"
      );
    })
    .join("");

  const discountRow =
    refund.discount_portion > 0
      ? '<tr><td>Less discount</td><td style="text-align:right">-' + money(refund.discount_portion) + "</td></tr>"
      : "";

  const taxRow =
    refund.tax_portion > 0
      ? '<tr><td>Tax</td><td style="text-align:right">+' + money(refund.tax_portion) + "</td></tr>"
      : "";

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#111">' +
    '<h2 style="text-align:center;margin:0 0 4px">' +
    esc(businessName) +
    "</h2>" +
    '<div style="text-align:center;font-weight:bold;letter-spacing:1px">REFUND</div>' +
    (refund.sale_number != null
      ? '<div style="text-align:center">For sale #' + refund.sale_number + "</div>"
      : "") +
    '<div style="text-align:center;color:#666;font-size:12px">' +
    (refund.fully ? "Full refund" : "Partial refund") +
    "</div>" +
    '<div style="text-align:center;color:#666;font-size:12px;margin-bottom:12px">' +
    esc(new Date(refund.refunded_at).toLocaleString()) +
    "</div>" +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    rows +
    "</table>" +
    '<hr style="border:none;border-top:1px solid #ddd;margin:10px 0" />' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
    '<tr><td>Items returned</td><td style="text-align:right">' +
    money(refund.returned_subtotal) +
    "</td></tr>" +
    discountRow +
    taxRow +
    '<tr><td style="font-weight:bold;padding-top:6px">Refunded</td><td style="text-align:right;font-weight:bold;padding-top:6px">-' +
    money(refund.amount) +
    "</td></tr>" +
    "</table>" +
    '<div style="text-align:center;color:#666;font-size:12px;margin-top:10px">Reason: ' +
    esc(reasonLabel) +
    "</div>" +
    '<p style="text-align:center;color:#666;font-size:12px;margin-top:12px">Thank you!</p>' +
    "</div>"
  );
}

// Re-render a past sale's receipt HTML from its stored snapshot, for reprinting from
// sales history (mirrors what emailReceipt sends). Business-scoped.
export async function getReceiptHtml(orderId: string): Promise<{ ok: true; html: string; sale_number: number | null } | { error: string }> {
  if (!orderId) return { error: "Missing sale." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, sale_number, snapshot, total, created_at")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { error: "Sale not found." };
  const html = buildReceiptHtml(business.name, {
    sale_number: order.sale_number != null ? Number(order.sale_number) : null,
    snapshot: order.snapshot,
    total: Number(order.total) || 0,
    created_at: order.created_at as string,
  });
  return { ok: true, html, sale_number: order.sale_number != null ? Number(order.sale_number) : null };
}

export async function emailReceipt(
  orderId: string,
  email: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing sale." };
  const to = (email || "").trim();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);
  if (!emailOk) return { error: "Enter a valid email address." };

  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet (missing RESEND_API_KEY)." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, sale_number, snapshot, total, created_at")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { error: "Sale not found." };

  const html = buildReceiptHtml(business.name, {
    sale_number: order.sale_number != null ? Number(order.sale_number) : null,
    snapshot: order.snapshot,
    total: Number(order.total) || 0,
    created_at: order.created_at as string,
  });
  const subject =
    "Receipt from " +
    business.name +
    (order.sale_number != null ? " - Sale #" + order.sale_number : "");

  const from =
    process.env.RECEIPT_FROM_EMAIL || business.name + " <onboarding@resend.dev>";

  const sent = await sendEmail({ to: to, from: from, subject: subject, html: html });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ("error" in sent) {
    await supabase.from("receipt_emails").insert({
      business_id: business.id,
      order_id: orderId,
      to_email: to,
      status: "failed",
      error: sent.error.slice(0, 300),
      sent_by: user ? user.id : null,
    });
    return { error: sent.error };
  }

  await supabase.from("receipt_emails").insert({
    business_id: business.id,
    order_id: orderId,
    to_email: to,
    status: "sent",
    provider_id: null,
    sent_by: user ? user.id : null,
  });

  revalidatePath("/app/pos/sales");
  return { ok: true };
}

export async function emailRefundReceipt(
  orderId: string,
  email: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing sale." };
  const to = (email || "").trim();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);
  if (!emailOk) return { error: "Enter a valid email address." };

  if (!isEmailConfigured()) {
    return { error: "Email isn't set up yet (missing RESEND_API_KEY)." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, sale_number, status, created_at")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { error: "Sale not found." };

  const { data: refund } = await supabase
    .from("refunds")
    .select("amount, reason, snapshot, created_at")
    .eq("order_id", orderId)
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!refund) return { error: "No refund has been recorded for this sale." };

  const snap =
    (refund.snapshot as {
      items?: { name?: string; quantity?: number; line_subtotal?: number }[];
      returned_subtotal?: number;
      discount_portion?: number;
      tax_portion?: number;
    } | null) || {};

  const items = (Array.isArray(snap.items) ? snap.items : []).map(function (l) {
    return {
      name: (l.name as string) || "Item",
      quantity: Number(l.quantity) || 0,
      line_subtotal: Number(l.line_subtotal) || 0,
    };
  });

  const html = buildRefundReceiptHtml(business.name, {
    sale_number: order.sale_number != null ? Number(order.sale_number) : null,
    refunded_at: refund.created_at as string,
    fully: (order.status as string) === "refunded",
    reason: (refund.reason as string) || "other",
    items: items,
    returned_subtotal: typeof snap.returned_subtotal === "number" ? snap.returned_subtotal : 0,
    discount_portion: typeof snap.discount_portion === "number" ? snap.discount_portion : 0,
    tax_portion: typeof snap.tax_portion === "number" ? snap.tax_portion : 0,
    amount: Number(refund.amount) || 0,
  });

  const subject =
    "Refund from " +
    business.name +
    (order.sale_number != null ? " - Sale #" + order.sale_number : "");

  const from =
    process.env.RECEIPT_FROM_EMAIL || business.name + " <onboarding@resend.dev>";

  const sent = await sendEmail({ to: to, from: from, subject: subject, html: html });
  if ("error" in sent) {
    return { error: sent.error };
  }

  return { ok: true };
}