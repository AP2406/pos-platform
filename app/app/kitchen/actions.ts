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