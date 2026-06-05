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
    return { error: "The day is already started. End it first." };
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
    // The partial unique index also rejects a double-open race.
    return { error: "Could not start the day. It may already be started." };
  }

  revalidatePath("/app/pos/drawer");
  revalidatePath("/app/pos");
  return { ok: true };
}

type CloseResult =
  | {
      ok: true;
      expected: number;
      counted: number;
      over_short: number;
      cash_sales: number;
      card_sales: number;
      other_sales: number;
      refunds: number;
      sale_count: number;
    }
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
    return { error: "There is no open day to end." };
  }

  const { data: sessionOrders } = await supabase
    .from("orders")
    .select("id, total, payment_method, status")
    .eq("business_id", business.id)
    .eq("drawer_session_id", session.id)
    .neq("is_training", true);

  const liveOrders = (sessionOrders ?? []).filter(
    (o) => (o.status as string) !== "voided"
  );
  const orderIds = liveOrders.map((o) => o.id as string);

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
  let cardSales = 0;
  let otherSales = 0;
  for (const p of payments) {
    if (p.method === "cash") cashSales += p.amount;
    else if (p.method === "card") cardSales += p.amount;
    else otherSales += p.amount;
  }
  for (const o of liveOrders) {
    if (ordersWithPayments.has(o.id as string)) continue;
    const t = Number(o.total) || 0;
    const m = (o.payment_method as string) || "cash";
    if (m === "cash") cashSales += t;
    else if (m === "card") cardSales += t;
    else otherSales += t;
  }
  cashSales = Math.round(cashSales * 100) / 100;
  cardSales = Math.round(cardSales * 100) / 100;
  otherSales = Math.round(otherSales * 100) / 100;

  // Refunds processed during this session take cash back out of the till.
  // Until card refunds go live, every refund is treated as cash out.
  const { data: refundData } = await supabase
    .from("refunds")
    .select("amount")
    .eq("business_id", business.id)
    .eq("drawer_session_id", session.id);
  let refundsTotal = 0;
  for (const r of refundData ?? []) refundsTotal += Number(r.amount) || 0;
  refundsTotal = Math.round(refundsTotal * 100) / 100;

  const startingCash = Number(session.starting_cash) || 0;
  const expected =
    Math.round((startingCash + cashSales - refundsTotal) * 100) / 100;
  const counted = Math.round((Number(input.counted_cash) || 0) * 100) / 100;
  const overShort = Math.round((counted - expected) * 100) / 100;
  const saleCount = liveOrders.length;

  const closeout = {
    starting_cash: startingCash,
    cash_sales: cashSales,
    card_sales: cardSales,
    other_sales: otherSales,
    refunds: refundsTotal,
    sale_count: saleCount,
    expected_cash: expected,
    counted_cash: counted,
    over_short: overShort,
  };

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
      closeout: closeout,
    })
    .eq("id", session.id)
    .eq("business_id", business.id)
    .eq("status", "open");

  if (error) {
    console.error("closeDrawerSession:", error);
    return { error: "Could not end the day. Please try again." };
  }

  revalidatePath("/app/pos/drawer");
  revalidatePath("/app/pos");
  return {
    ok: true,
    expected,
    counted,
    over_short: overShort,
    cash_sales: cashSales,
    card_sales: cardSales,
    other_sales: otherSales,
    refunds: refundsTotal,
    sale_count: saleCount,
  };
}