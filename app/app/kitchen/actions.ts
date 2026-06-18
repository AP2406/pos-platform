"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function markOrderFulfilled(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("markOrderFulfilled:", error);
    return { error: "Could not update the order." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}

// Re-fire a kitchen ticket: insert a fresh copy so it reappears on the KDS
// (e.g. a lost or unreadable ticket). Does not touch orders/revenue.
export async function refireKitchenTicket(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: t } = await supabase
    .from("kitchen_tickets")
    .select("element_id, label, items")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!t) return { error: "That ticket is gone." };

  const { error } = await supabase.from("kitchen_tickets").insert({
    business_id: business.id,
    element_id: (t.element_id as string | null) ?? null,
    label: (t.label as string | null) ?? null,
    items: t.items,
    created_by: user ? user.id : null,
  });
  if (error) {
    console.error("refireKitchenTicket:", error);
    return { error: "Could not re-fire the ticket." };
  }
  revalidatePath("/app/kitchen");
  return { ok: true };
}

// Recall (un-bump) a kitchen ticket: clear fulfilled_at so it returns to the
// active board in its EXACT prior state — the per-item `ready` flags live on the
// items jsonb and are never cleared on bump, so a recalled ticket shows which
// lines were already plated. Distinct from re-fire (which makes a fresh copy).
export async function recallKitchenTicket(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("kitchen_tickets")
    .update({ fulfilled_at: null })
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (error) {
    console.error("recallKitchenTicket:", error);
    return { error: "Could not recall the ticket." };
  }
  revalidatePath("/app/kitchen");
  return { ok: true };
}

// Recall an online/takeout order ticket — clears fulfilled_at; the per-item
// prepared set (orders.kds_prepared) is preserved, so it returns with the same
// lines bumped.
export async function recallOrder(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ fulfilled_at: null })
    .eq("id", orderId)
    .eq("business_id", business.id);
  if (error) {
    console.error("recallOrder:", error);
    return { error: "Could not recall the order." };
  }
  revalidatePath("/app/kitchen");
  return { ok: true };
}

// P1-17: mark a single line on a fired ticket ready (or un-ready) as the cook
// plates it. Stored as a `ready` flag inside the items jsonb — that array is the
// fired kitchen snapshot, never a financial record, so mutating it is safe.
export async function setKitchenItemReady(
  ticketId: string,
  index: number,
  ready: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("kitchen_tickets")
    .select("items")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!t) return { error: "That ticket is gone." };

  const items = Array.isArray(t.items) ? (t.items as Record<string, unknown>[]) : [];
  if (index < 0 || index >= items.length) return { error: "Item not found." };
  items[index] = { ...items[index], ready };

  const { error } = await supabase
    .from("kitchen_tickets")
    .update({ items })
    .eq("id", ticketId)
    .eq("business_id", business.id);

  if (error) {
    console.error("setKitchenItemReady:", error);
    return { error: "Could not update the item." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}

// Per-line prep state for online/takeout/delivery "order" tickets (which have no
// kitchen_tickets row). Stored as the set of prepared order_item ids in
// orders.kds_prepared — a non-financial column the settled-order guard permits,
// never read by any pricing/total/refund logic. KDS display state only.
export async function setOrderItemPrepared(
  orderId: string,
  orderItemId: string,
  prepared: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!orderId || !orderItemId) return { error: "Missing order item." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: o } = await supabase
    .from("orders")
    .select("kds_prepared")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!o) return { error: "That order is gone." };

  const cur = Array.isArray(o.kds_prepared) ? (o.kds_prepared as string[]) : [];
  const set = new Set(cur);
  if (prepared) set.add(orderItemId);
  else set.delete(orderItemId);

  const { error } = await supabase
    .from("orders")
    .update({ kds_prepared: [...set] })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("setOrderItemPrepared:", error);
    return { error: "Could not update the item." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}

// P1-16: bump every open ticket for one table at once from the expo view, so the
// expediter can send the whole table out when it's plated. Orders/revenue untouched.
export async function markKitchenTicketsFulfilled(
  ticketIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const ids = (ticketIds || []).filter((x) => typeof x === "string" && x.length > 0);
  if (ids.length === 0) return { error: "Nothing to bump." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("kitchen_tickets")
    .update({ fulfilled_at: new Date().toISOString() })
    .in("id", ids)
    .eq("business_id", business.id);

  if (error) {
    console.error("markKitchenTicketsFulfilled:", error);
    return { error: "Could not bump the table." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}

export async function markKitchenTicketFulfilled(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("kitchen_tickets")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("business_id", business.id);

  if (error) {
    console.error("markKitchenTicketFulfilled:", error);
    return { error: "Could not update the ticket." };
  }

  revalidatePath("/app/kitchen");
  return { ok: true };
}