"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function openDrawerSession(
  startingCash: number
): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const start = Math.round((Number(startingCash) || 0) * 100) / 100;
  if (start < 0) return { error: "Starting cash cannot be negative." };

  const { data: existing } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    return { error: "A register session is already open. Close it first." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("drawer_sessions").insert({
    business_id: business.id,
    opened_by: user ? user.id : null,
    starting_cash: start,
    status: "open",
  });

  if (error) {
    console.error("openDrawerSession:", error);
    return { error: "Could not open the register. Please try again." };
  }

  revalidatePath("/app/pos/drawer");
  return { ok: true };
}

type CloseResult =
  | { ok: true; expected: number; counted: number; over_short: number }
  | { error: string };

export async function closeDrawerSession(input: {
  counted_cash: number;
  note?: string;
}): Promise<CloseResult> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("drawer_sessions")
    .select("id, starting_cash")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  if (!session) {
    return { error: "There is no open register session to close." };
  }

  const { data: sessionOrders } = await supabase
    .from("orders")
    .select("id, total, payment_method, status")
    .eq("business_id", business.id)
    .eq("drawer_session_id", session.id);

  const liveOrders = (sessionOrders ?? []).filter(
    (o) => (o.status as string) !== "voided"
  );
  const orderIds = liveOrders.map((o) => o.id as string);

  // Cash taken is the sum of the cash PORTION of each sale. Split tenders make
  // a single order both cash and card, so we read from the payments ledger.
  let payments: { order_id: string; method: string; amount: number }[] = [];
  if (orderIds.length > 0) {
    const { data: payData } = await supabase
      .from("payments")
      .select("order_id, method, amount")
      .eq("business_id", business.id)
      .in("order_id", orderIds);
    payments = (payData ?? []).map((p) => ({
      order_id: p.order_id as string,
      method: p.method as string,
      amount: Number(p.amount) || 0,
    }));
  }
  const ordersWithPayments = new Set(payments.map((p) => p.order_id));

  let cashSales = 0;
  for (const p of payments) {
    if (p.method === "cash") cashSales += p.amount;
  }
  // Back-compat: sales recorded before the payments ledger have no rows; fall
  // back to the single method stored on the order.
  for (const o of liveOrders) {
    if (
      !ordersWithPayments.has(o.id as string) &&
      (o.payment_method as string) === "cash"
    ) {
      cashSales += Number(o.total) || 0;
    }
  }
  cashSales = Math.round(cashSales * 100) / 100;

  const startingCash = Number(session.starting_cash) || 0;
  const expected = Math.round((startingCash + cashSales) * 100) / 100;
  const counted = Math.round((Number(input.counted_cash) || 0) * 100) / 100;
  const overShort = Math.round((counted - expected) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("drawer_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user ? user.id : null,
      counted_cash: counted,
      expected_cash: expected,
      over_short: overShort,
      note:
        input.note && input.note.trim()
          ? input.note.trim().slice(0, 500)
          : null,
    })
    .eq("id", session.id)
    .eq("business_id", business.id);

  if (error) {
    console.error("closeDrawerSession:", error);
    return { error: "Could not close the register. Please try again." };
  }

  revalidatePath("/app/pos/drawer");
  return { ok: true, expected, counted, over_short: overShort };
}