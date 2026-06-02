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
    } | null) || {};

  const items = Array.isArray(snap.items) ? snap.items : [];
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