import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { DrawerClient } from "./drawer-client";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function DrawerPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: sessionData } = await supabase
    .from("drawer_sessions")
    .select("id, opened_at, starting_cash")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();

  let open:
    | null
    | {
        id: string;
        opened_at: string;
        starting_cash: number;
        cash: number;
        card: number;
        other: number;
        expected: number;
        count: number;
      } = null;

  if (sessionData) {
    const { data: orders } = await supabase
      .from("orders")
      .select("total, payment_method, status")
      .eq("business_id", business.id)
      .eq("drawer_session_id", sessionData.id);

    let cash = 0;
    let card = 0;
    let other = 0;
    let count = 0;
    for (const o of orders ?? []) {
      if ((o.status as string) === "voided") continue;
      const t = Number(o.total) || 0;
      const m = (o.payment_method as string) || "cash";
      if (m === "cash") cash += t;
      else if (m === "card") card += t;
      else other += t;
      count += 1;
    }

    const startingCash = Number(sessionData.starting_cash) || 0;
    open = {
      id: sessionData.id as string,
      opened_at: sessionData.opened_at as string,
      starting_cash: startingCash,
      cash: round2(cash),
      card: round2(card),
      other: round2(other),
      expected: round2(startingCash + cash),
      count,
    };
  }

  const { data: closedData } = await supabase
    .from("drawer_sessions")
    .select(
      "id, opened_at, closed_at, starting_cash, counted_cash, expected_cash, over_short"
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