import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { sendSms, isSmsConfigured } from "@/lib/services/sms";
import { sendDeliverectStatus } from "@/lib/services/deliverect";

// Param-based order-fulfillment cores (no cookies) shared by the web kitchen
// actions and the native v1 fulfillment endpoint, so both run the SAME order-ready
// notification + recall audit. Fulfillment/kitchen state — money-independent.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sb = SupabaseClient<any, "public", any>;
export type CoreBiz = { id: string; name?: string | null; settings?: Record<string, unknown> | null };

export async function markOrderFulfilledCore(supabase: Sb, business: CoreBiz, orderId: string): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from("orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("business_id", business.id);
  if (error) {
    console.error("markOrderFulfilledCore:", error);
    return { error: "Could not update the order." };
  }

  // B7: ready-for-pickup notification (email + SMS) for takeout/pickup/delivery
  // orders with contact info. Best-effort; toggle via settings.pickup_notify.
  const settings = (business.settings ?? {}) as Record<string, unknown>;
  if (settings.pickup_notify !== false) {
    const { data: ord } = await supabase
      .from("orders")
      // dining_option is snapshot-only (NOT a column) — selecting it as a column
      // errored the whole query, which silently killed this ready notification.
      .select("snapshot, customer_id, sale_number")
      .eq("id", orderId)
      .eq("business_id", business.id)
      .maybeSingle();
    const dopt = ((ord?.snapshot ?? null) as { dining_option?: string | null } | null)?.dining_option ?? null;
    if (ord?.customer_id && (dopt === "takeout" || dopt === "pickup" || dopt === "delivery")) {
      const { data: cust } = await supabase.from("customers").select("name, email, phone").eq("id", ord.customer_id as string).maybeSingle();
      const biz = business.name || "your order";
      const label = ord.sale_number ? "Order #" + ord.sale_number : "Your order";
      const readyWord = dopt === "delivery" ? "on its way" : "ready for pickup";
      const reviewUrl = typeof settings.review_url === "string" && settings.review_url.trim() ? settings.review_url.trim() : null;

      const email = (cust?.email as string | null) ?? null;
      if (email && isEmailConfigured()) {
        await sendEmail({
          to: email,
          subject: (dopt === "delivery" ? "Out for delivery" : "Ready for pickup") + " — " + biz,
          html:
            `<p>Hi ${(cust?.name as string | null) ?? "there"},</p><p><strong>${label}</strong> at ${biz} is ${readyWord}. See you soon!</p>` +
            (reviewUrl ? `<p>Enjoyed it? <a href="${reviewUrl}">Leave us a review</a> — it really helps.</p>` : ""),
        });
      }
      const phone = (cust?.phone as string | null) ?? null;
      if (phone && isSmsConfigured()) {
        const smsBody = `${label} at ${biz} is ${readyWord}.` + (reviewUrl ? ` Loved it? Review us: ${reviewUrl}` : "");
        await sendSms({ to: phone, body: smsBody });
      }
    }
  }

  // Channel (Deliverect) orders: report READY back so the courier is dispatched.
  // Creds-gated — no-ops until a merchant token is connected. Never blocks.
  const { data: dlv } = await supabase
    .from("delivery_orders")
    .select("external_id")
    .eq("order_id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (dlv?.external_id) {
    const res = await sendDeliverectStatus(supabase, business.id, dlv.external_id as string, "ready");
    if (!res.sent && res.skipped) console.log("deliverect ready skipped:", res.skipped);
  }

  return { ok: true };
}

export async function recallOrderCore(supabase: Sb, businessId: string, orderId: string, actorId: string | null): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("orders").update({ fulfilled_at: null }).eq("id", orderId).eq("business_id", businessId);
  if (error) {
    console.error("recallOrderCore:", error);
    return { error: "Could not recall the order." };
  }
  await supabase.from("audit_events").insert({ business_id: businessId, actor_id: actorId, action: "kds_recall", metadata: { order_id: orderId, kind: "order" } });
  return { ok: true };
}
