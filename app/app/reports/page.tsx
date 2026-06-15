import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { hasFloorService } from "@/lib/modules/modes";

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
  staff_id: string | null;
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

  // Show the cross-location link only to owners/managers of more than one business.
  const myBusinesses = await listBusinesses();
  const multiLocation =
    myBusinesses.filter((b) => b.role === "owner" || b.role === "manager").length > 1;

  const rangeLabels: Record<string, string> = {
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
  };

  const cutoffIso = new Date(Date.now() - 31 * 86400000).toISOString();
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, created_at, subtotal, discount, tax, tip, total, payment_method, status, staff_id")
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
    staff_id: (o.staff_id as string | null) ?? null,
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

  const payTotals: Record<string, number> = { cash: 0, card: 0, gift_card: 0, store_credit: 0, other: 0 };
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
      if (payTotals[m] !== undefined) payTotals[m] += amt;
      else payTotals.other += amt;
    }
    for (const o of orders) {
      if (paidOrderIds.has(o.id)) continue;
      const m = o.payment_method;
      if (payTotals[m] !== undefined) payTotals[m] += o.total;
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
  const giftCard = round2(payTotals.gift_card);
  const storeCredit = round2(payTotals.store_credit);
  const other = round2(payTotals.other);

  const topItems = Object.keys(itemAgg)
    .map((k) => itemAgg[k])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const categories = Object.keys(catAgg)
    .map((k) => ({ name: k, qty: catAgg[k].qty, revenue: catAgg[k].revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // P1-23: per-server sales (full service). Each server's net sales, tips,
  // order count and average check, from the order's attributed staff_id.
  const showServers = hasFloorService(business);
  type ServerAgg = { staffId: string; name: string; count: number; sales: number; tips: number; hours: number };
  let servers: ServerAgg[] = [];
  if (showServers) {
    const agg: Record<string, { count: number; sales: number; tips: number }> = {};
    for (const o of orders) {
      const sid = o.staff_id;
      if (!sid) continue;
      if (!agg[sid]) agg[sid] = { count: 0, sales: 0, tips: 0 };
      agg[sid].count += 1;
      agg[sid].sales += o.subtotal;
      agg[sid].tips += o.tip;
    }

    // P1-24 labor: clocked hours per staff in the same range. A shift counts
    // toward the range if it clocked in within it; open shifts count up to now.
    const rangeStartMs =
      range === "today"
        ? new Date(todayKey + "T00:00:00").getTime() // local-ish midnight; fine for bucketing
        : range === "7d"
          ? now - 7 * 86400000
          : now - 30 * 86400000;
    const hoursByStaff: Record<string, number> = {};
    const { data: shifts } = await supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out")
      .eq("business_id", business.id)
      .gte("clock_in", new Date(rangeStartMs).toISOString());
    for (const sh of shifts ?? []) {
      const sid = sh.staff_id as string;
      const inMs = new Date(sh.clock_in as string).getTime();
      const outMs = sh.clock_out ? new Date(sh.clock_out as string).getTime() : now;
      const hrs = Math.max(0, (outMs - inMs) / 3600000);
      hoursByStaff[sid] = (hoursByStaff[sid] ?? 0) + hrs;
    }

    // Include staff who clocked hours even with no attributed sales.
    const sids = Array.from(new Set([...Object.keys(agg), ...Object.keys(hoursByStaff)]));
    const nameById: Record<string, string> = {};
    if (sids.length > 0) {
      const { data: staffRows } = await supabase
        .from("staff_members")
        .select("id, name")
        .eq("business_id", business.id)
        .in("id", sids);
      for (const s of staffRows ?? []) nameById[s.id as string] = s.name as string;
    }
    servers = sids
      .map((sid) => ({
        staffId: sid,
        name: nameById[sid] ?? "Server",
        count: agg[sid]?.count ?? 0,
        sales: round2(agg[sid]?.sales ?? 0),
        tips: round2(agg[sid]?.tips ?? 0),
        hours: Math.round((hoursByStaff[sid] ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));
  }

  const tabs: { key: string; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {"Sales for " + rangeLabels[range].toLowerCase() + ". Voided sales are excluded."}
          </p>
        </div>
        {multiLocation && (
          <Link
            href="/app/locations"
            className="shrink-0 text-sm rounded-md border border-border px-2.5 py-1.5 hover:bg-accent"
          >
            All locations
          </Link>
        )}
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
          {giftCard > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">Gift card</div>
              <div className="tabular-nums">{money(giftCard)}</div>
            </div>
          )}
          {storeCredit > 0 && (
            <div>
              <div className="text-muted-foreground text-xs">Store credit</div>
              <div className="tabular-nums">{money(storeCredit)}</div>
            </div>
          )}
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

      {showServers && (
        <div className="mt-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">By server</h2>
          {servers.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-sm text-muted-foreground">No server-attributed sales in this period.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-4 py-2">Server</th>
                    <th className="text-right font-medium px-4 py-2">Sales</th>
                    <th className="text-right font-medium px-4 py-2">Checks</th>
                    <th className="text-right font-medium px-4 py-2">Avg check</th>
                    <th className="text-right font-medium px-4 py-2">Tips</th>
                    <th className="text-right font-medium px-4 py-2">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {servers.map((s) => (
                    <tr key={s.staffId}>
                      <td className="px-4 py-2.5 font-medium truncate">{s.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(s.sales)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{money(round2(s.count > 0 ? s.sales / s.count : 0))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(s.tips)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{s.hours > 0 ? s.hours.toFixed(1) + "h" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}