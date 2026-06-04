import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { DrawerClient } from "./drawer-client";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Closeout = {
  starting_cash: number;
  cash_sales: number;
  card_sales: number;
  other_sales: number;
  refunds: number;
  sale_count: number;
  expected_cash: number;
  counted_cash: number;
  over_short: number;
};

type OpenSession = {
  id: string;
  opened_at: string;
  starting_cash: number;
  cash: number;
  card: number;
  other: number;
  refunds: number;
  expected: number;
  count: number;
};

export default async function DrawerPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: sessionData } = await supabase
    .from("drawer_sessions")
    .select("id, opened_at, starting_cash")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();

  let open: OpenSession | null = null;

  if (sessionData) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, payment_method, status")
      .eq("business_id", business.id)
      .eq("drawer_session_id", sessionData.id)
      .neq("is_training", true);

    const liveOrders = (orders ?? []).filter(
      (o) => (o.status as string) !== "voided"
    );
    const count = liveOrders.length;
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

    let cash = 0;
    let card = 0;
    let other = 0;

    for (const p of payments) {
      if (p.method === "cash") cash += p.amount;
      else if (p.method === "card") card += p.amount;
      else other += p.amount;
    }
    for (const o of liveOrders) {
      if (ordersWithPayments.has(o.id as string)) continue;
      const t = Number(o.total) || 0;
      const m = (o.payment_method as string) || "cash";
      if (m === "cash") cash += t;
      else if (m === "card") card += t;
      else other += t;
    }

    const { data: refundData } = await supabase
      .from("refunds")
      .select("amount")
      .eq("business_id", business.id)
      .eq("drawer_session_id", sessionData.id);
    let refundsTotal = 0;
    for (const r of refundData ?? []) refundsTotal += Number(r.amount) || 0;
    refundsTotal = round2(refundsTotal);

    const startingCash = Number(sessionData.starting_cash) || 0;
    open = {
      id: sessionData.id as string,
      opened_at: sessionData.opened_at as string,
      starting_cash: startingCash,
      cash: round2(cash),
      card: round2(card),
      other: round2(other),
      refunds: refundsTotal,
      expected: round2(startingCash + cash - refundsTotal),
      count,
    };
  }

  const { data: closedData } = await supabase
    .from("drawer_sessions")
    .select(
      "id, opened_at, closed_at, starting_cash, counted_cash, expected_cash, over_short, closeout"
    )
    .eq("business_id", business.id)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(10);

  const closed = (closedData ?? []).map((s) => ({
    id: s.id as string,
    opened_at: s.opened_at as string,
    closed_at: (s.closed_at as string | null) ?? null,
    starting_cash: Number(s.starting_cash) || 0,
    counted_cash: Number(s.counted_cash) || 0,
    expected_cash: Number(s.expected_cash) || 0,
    over_short: Number(s.over_short) || 0,
    closeout: (s.closeout as Closeout | null) ?? null,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Cash drawer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Open a drawer to start the day, then close it to count cash and see
          over/short.
        </p>
      </div>
      <DrawerClient open={open} closed={closed} />
    </div>
  );
}