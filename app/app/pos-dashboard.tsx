import { createClient } from "@/lib/supabase/server";
import {
  getTodayBoundsUTC,
  getWeekBoundsUTC,
  getMonthBoundsUTC,
} from "@/lib/utils/dates";
import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { DollarSign, Receipt, TrendingUp, AlertTriangle } from "lucide-react";

type Biz = {
  id: string;
  name: string;
  industry: string;
  currency: string;
  timezone: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

export async function PosDashboard({ business }: { business: Biz }) {
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const currency = business.currency || "CAD";
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  const timeOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);
  const { start: weekStart, end: weekEnd } = getWeekBoundsUTC(tz);
  const { start: monthStart, end: monthEnd } = getMonthBoundsUTC(tz);

  const sel =
    "id, created_at, total, subtotal, discount, status, is_training, sale_number, payment_method, snapshot";

  const [todayRes, weekRes, monthRes, recentRes, stockRes] = await Promise.all([
    supabase
      .from("orders")
      .select("total, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", todayEnd.toISOString()),
    supabase
      .from("orders")
      .select("total, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString()),
    supabase
      .from("orders")
      .select("total, is_training, snapshot")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString()),
    supabase
      .from("orders")
      .select(sel)
      .eq("business_id", business.id)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("catalog_items")
      .select("id, name, stock_qty, reorder_point, track_inventory")
      .eq("business_id", business.id)
      .eq("track_inventory", true),
  ]);

  function totals(rows: Row[]): { gross: number; count: number } {
    let gross = 0;
    let count = 0;
    for (const o of rows) {
      if (o.is_training) continue;
      gross += num(o.total);
      count += 1;
    }
    return { gross: gross, count: count };
  }

  const today = totals((todayRes.data ?? []) as Row[]);
  const week = totals((weekRes.data ?? []) as Row[]);
  const month = totals((monthRes.data ?? []) as Row[]);
  const avgTicketMonth = month.count > 0 ? month.gross / month.count : 0;
  const avgTicketToday = today.count > 0 ? today.gross / today.count : 0;

  // Top items this month, aggregated from immutable order snapshots.
  const itemAgg: Record<string, { qty: number; revenue: number }> = {};
  for (const o of (monthRes.data ?? []) as Row[]) {
    if (o.is_training) continue;
    const snap = o.snapshot as { items?: Row[] } | null;
    const items = snap && Array.isArray(snap.items) ? snap.items : [];
    for (const it of items) {
      const name = (it.name || "Item").toString();
      const qty = num(it.quantity);
      const rev = num(it.unit_price) * qty;
      if (!itemAgg[name]) itemAgg[name] = { qty: 0, revenue: 0 };
      itemAgg[name].qty += qty;
      itemAgg[name].revenue += rev;
    }
  }
  const topItems = Object.keys(itemAgg)
    .map((name) => ({ name: name, qty: itemAgg[name].qty, revenue: itemAgg[name].revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const recent = ((recentRes.data ?? []) as Row[])
    .filter((o) => !o.is_training)
    .slice(0, 8);

  const lowStock = ((stockRes.data ?? []) as Row[]).filter(
    (i) => num(i.stock_qty) <= num(i.reorder_point)
  );

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">{dateLabel}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Link
            href="/app/m"
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent"
          >
            Live
          </Link>
          <Link
            href="/app/pos"
            className="px-3 py-1.5 text-sm rounded-md border border-foreground bg-accent font-medium"
          >
            New sale
          </Link>
        </div>
      </div>

      <SectionHeader>Today</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          hero
          label="Today's sales"
          value={money(today.gross)}
          hint={today.count + (today.count === 1 ? " sale" : " sales")}
          icon={<DollarSign />}
        />
        <MetricCard label="Transactions" value={today.count.toString()} hint="Today" icon={<Receipt />} />
        <MetricCard label="Avg ticket" value={money(avgTicketToday)} hint="Today" icon={<TrendingUp />} />
        <MetricCard
          label="Low stock"
          value={lowStock.length.toString()}
          hint={lowStock.length > 0 ? "Items to reorder" : "All stocked"}
          tone={lowStock.length > 0 ? "warning" : "default"}
          icon={<AlertTriangle />}
        />
      </div>

      <SectionHeader>This period</SectionHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="This week" value={money(week.gross)} hint={week.count + (week.count === 1 ? " sale" : " sales")} />
        <StatCard label="This month" value={money(month.gross)} hint={month.count + (month.count === 1 ? " sale" : " sales")} />
        <StatCard label="Avg ticket" value={money(avgTicketMonth)} hint="This month" />
      </div>

      <SectionHeader>Top items this month</SectionHeader>
      {topItems.length === 0 ? (
        <EmptyState message="No sales yet this month." />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {topItems.map((it) => (
            <div key={it.name} className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground">
                  {it.qty + (it.qty === 1 ? " sold" : " sold")}
                </div>
              </div>
              <div className="font-semibold tabular-nums">{money(it.revenue)}</div>
            </div>
          ))}
        </div>
      )}

      <SectionHeader>Recent sales</SectionHeader>
      {recent.length === 0 ? (
        <EmptyState message="No sales recorded yet." />
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {recent.map((o) => {
            const snap = o.snapshot as { items?: Row[] } | null;
            const itemCount =
              snap && Array.isArray(snap.items)
                ? snap.items.reduce((s: number, it: Row) => s + num(it.quantity), 0)
                : 0;
            const label =
              o.sale_number != null ? "Sale #" + o.sale_number : "Sale";
            const refunded =
              o.status === "refunded" || o.status === "partially_refunded";
            return (
              <div key={o.id} className="p-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {label}
                    {refunded && (
                      <span className="ml-2 text-xs text-amber-600">
                        {o.status === "refunded" ? "Refunded" : "Partial refund"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {timeOf(o.created_at) +
                      "  \u00b7  " +
                      itemCount +
                      (itemCount === 1 ? " item  \u00b7  " : " items  \u00b7  ") +
                      String(o.payment_method || "")}
                  </div>
                </div>
                <div className="font-semibold tabular-nums">{money(num(o.total))}</div>
              </div>
            );
          })}
        </div>
      )}

      {lowStock.length > 0 && (
        <>
          <SectionHeader>Low stock</SectionHeader>
          <div className="bg-amber-50/30 border border-amber-200 rounded-lg divide-y divide-amber-100 overflow-hidden">
            {lowStock.slice(0, 8).map((i) => (
              <Link
                key={i.id}
                href="/app/inventory"
                className="block p-3 hover:bg-white/60 transition-colors flex items-center justify-between"
              >
                <span className="font-medium truncate">{i.name}</span>
                <span className="text-sm text-amber-700 tabular-nums">
                  {num(i.stock_qty) + " left"}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-3 mt-8">
      {children}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warning" | "neutral";
}) {
  return (
    <div className="group bg-card border border-border rounded-lg p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.04)]">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={
          "text-2xl font-semibold mt-2 tabular-nums tracking-tight " +
          (tone === "warning" ? "text-amber-600" : "text-foreground")
        }
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}