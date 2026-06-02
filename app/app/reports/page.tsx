import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

type OrderRow = {
  id: string;
  created_at: string;
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  status: string;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function money(n: number): string {
  return "$" + n.toFixed(2);
}

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const sp = await searchParams;
  const range = sp.range === "today" || sp.range === "30d" ? sp.range : "7d";

  const rangeLabels: Record<string, string> = {
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
  };

  const cutoffIso = new Date(Date.now() - 31 * 86400000).toISOString();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, created_at, subtotal, discount, tax, tip, total, payment_method, status")
    .eq("business_id", business.id)
    .neq("is_training", true)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(3000);

  const allOrders: OrderRow[] = (ordersData ?? []).map((o) => ({
    id: o.id as string,
    created_at: o.created_at as string,
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    tip: Number(o.tip) || 0,
    total: Number(o.total) || 0,
    payment_method: (o.payment_method as string | null) ?? "cash",
    status: (o.status as string | null) ?? "paid",
  }));

  const now = Date.now();
  const todayKey = dayKey(new Date().toISOString(), tz);
  const inRange = (o: OrderRow): boolean => {
    if (range === "today") return dayKey(o.created_at, tz) === todayKey;
    if (range === "7d") return new Date(o.created_at).getTime() >= now - 7 * 86400000;
    return new Date(o.created_at).getTime() >= now - 30 * 86400000;
  };

  const orders = allOrders.filter((o) => o.status !== "voided" && inRange(o));
  const orderIds = orders.map((o) => o.id);

  const count = orders.length;
  const gross = round2(orders.reduce((a, o) => a + o.subtotal, 0));
  const discounts = round2(orders.reduce((a, o) => a + o.discount, 0));
  const tax = round2(orders.reduce((a, o) => a + o.tax, 0));
  const tips = round2(orders.reduce((a, o) => a + o.tip, 0));
  const collected = round2(orders.reduce((a, o) => a + o.total, 0));

  const payTotals: Record<string, number> = { cash: 0, card: 0, other: 0 };
  let refunds = 0;
  const itemAgg: Record<string, { name: string; qty: number; revenue: number; catId: string | null }> = {};
  const catAgg: Record<string, { qty: number; revenue: number }> = {};

  if (orderIds.length > 0) {
    const { data: payData } = await supabase
      .from("payments")
      .select("order_id, method, amount")
      .eq("business_id", business.id)
      .in("order_id", orderIds);
    const paidOrderIds = new Set<string>();
    for (const p of payData ?? []) {
      const m = (p.method as string) || "other";
      const amt = Number(p.amount) || 0;
      paidOrderIds.add(p.order_id as string);
      if (m === "cash") payTotals.cash += amt;
      else if (m === "card") payTotals.card += amt;
      else payTotals.other += amt;
    }
    for (const o of orders) {
      if (paidOrderIds.has(o.id)) continue;
      const m = o.payment_method;
      if (m === "cash") payTotals.cash += o.total;
      else if (m === "card") payTotals.card += o.total;
      else payTotals.other += o.total;
    }

    const { data: refundData } = await supabase
      .from("refunds")
      .select("amount")
      .eq("business_id", business.id)
      .in("order_id", orderIds);
    for (const r of refundData ?? []) {
      refunds += Number(r.amount) || 0;
    }

    const { data: lineData } = await supabase
      .from("order_items")
      .select("catalog_item_id, name, unit_price, quantity")
      .eq("business_id", business.id)
      .in("order_id", orderIds);

    const lines = lineData ?? [];
    const catItemIds = Array.from(
      new Set(
        lines
          .map((l) => l.catalog_item_id as string | null)
          .filter((id): id is string => !!id)
      )
    );
    const catById: Record<string, string | null> = {};
    if (catItemIds.length > 0) {
      const { data: cats } = await supabase
        .from("catalog_items")
        .select("id, category")
        .eq("business_id", business.id)
        .in("id", catItemIds);
      for (const c of cats ?? []) {
        catById[c.id as string] = (c.category as string | null) ?? null;
      }
    }

    for (const l of lines) {
      const cid = (l.catalog_item_id as string | null) ?? null;
      const name = (l.name as string) || "Item";
      const qty = Number(l.quantity) || 0;
      const revenue = (Number(l.unit_price) || 0) * qty;
      const key = cid ? "id:" + cid : "name:" + name;
      if (!itemAgg[key]) itemAgg[key] = { name: name, qty: 0, revenue: 0, catId: cid };
      itemAgg[key].qty += qty;
      itemAgg[key].revenue += revenue;

      const catLabel = (cid && catById[cid]) || "Uncategorized";
      if (!catAgg[catLabel]) catAgg[catLabel] = { qty: 0, revenue: 0 };
      catAgg[catLabel].qty += qty;
      catAgg[catLabel].revenue += revenue;
    }
  }

  refunds = round2(refunds);
  const net = round2(collected - refunds);
  const cash = round2(payTotals.cash);
  const card = round2(payTotals.card);
  const other = round2(payTotals.other);

  const topItems = Object.keys(itemAgg)
    .map((k) => itemAgg[k])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const categories = Object.keys(catAgg)
    .map((k) => ({ name: k, qty: catAgg[k].qty, revenue: catAgg[k].revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const tabs: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {"Sales for " + rangeLabels[range].toLowerCase() + ". Voided sales are excluded."}
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => {
          const active = range === t.key;
          return (
            <Link
              key={t.key}
              href={"/app/reports?range=" + t.key}
              className={
                "px-3 py-1.5 text-sm rounded-md border transition-colors " +
                (active
                  ? "border-foreground bg-accent font-medium"
                  : "border-border hover:border-foreground/40")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Summary</h2>
          <span className="text-xs text-muted-foreground">
            {count + (count === 1 ? " sale" : " sales")}
          </span>
        </div>

        <div className="text-3xl font-semibold tabular-nums">{money(net)}</div>
        <div className="text-xs text-muted-foreground mt-1">net of refunds</div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Gross</div>
            <div className="tabular-nums">{money(gross)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Discounts</div>
            <div className={"tabular-nums " + (discounts > 0 ? "text-red-500" : "")}>
              {discounts > 0 ? "-" + money(discounts) : money(0)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tax</div>
            <div className="tabular-nums">{money(tax)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Tips</div>
            <div className="tabular-nums">{money(tips)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Collected</div>
            <div className="tabular-nums">{money(collected)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Refunds</div>
            <div className={"tabular-nums " + (refunds > 0 ? "text-red-500" : "")}>
              {refunds > 0 ? "-" + money(refunds) : money(0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Cash</div>
            <div className="tabular-nums">{money(cash)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Card</div>
            <div className="tabular-nums">{money(card)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Other</div>
            <div className="tabular-nums">{money(other)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Top items</h2>
          {topItems.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No items sold in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {topItems.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.qty + (it.qty === 1 ? " sold" : " sold")}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums shrink-0">
                    {money(round2(it.revenue))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">By category</h2>
          {categories.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No category data in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.qty + " items"}
                    </div>
                  </div>
                  <div className="text-sm tabular-nums shrink-0">
                    {money(round2(c.revenue))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}