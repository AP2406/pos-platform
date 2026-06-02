import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { VoidButton } from "./void-button";

type Row = {
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

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function money(n: number): string {
  return "$" + n.toFixed(2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDaysKey(key: string, delta: number): string {
  const parts = key.split("-").map(Number);
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

function isoFromKey(key: string): string {
  const parts = key.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString();
}

export default async function SalesPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";

  const todayKey = dayKey(new Date().toISOString(), tz);
  const monthPrefix = todayKey.slice(0, 7);
  const monthStartKey = monthPrefix + "-01";
  const weekStartKey = addDaysKey(todayKey, -6);
  const earliestKey =
    weekStartKey < monthStartKey ? weekStartKey : monthStartKey;
  const sinceIso = isoFromKey(addDaysKey(earliestKey, -2));

  const selectCols =
    "id, created_at, subtotal, discount, tax, tip, total, payment_method, status";

  const [summaryRes, listRes] = await Promise.all([
    supabase
      .from("orders")
      .select(selectCols)
      .eq("business_id", business.id)
      .gte("created_at", sinceIso),
    supabase
      .from("orders")
      .select(selectCols)
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const toRow = (o: Record<string, unknown>): Row => ({
    id: o.id as string,
    created_at: o.created_at as string,
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    tip: Number(o.tip) || 0,
    total: Number(o.total) || 0,
    payment_method: (o.payment_method as string | null) ?? "cash",
    status: (o.status as string | null) ?? "paid",
  });

  const summaryRows: Row[] = (summaryRes.data ?? []).map(toRow);
  const listRows: Row[] = (listRes.data ?? []).map(toRow);

  const live = summaryRows.filter((r) => r.status !== "voided");
  const today = live.filter((r) => dayKey(r.created_at, tz) === todayKey);
  const week = live.filter((r) => dayKey(r.created_at, tz) >= weekStartKey);
  const month = live.filter(
    (r) => dayKey(r.created_at, tz).slice(0, 7) === monthPrefix
  );

  const sumOf = (arr: Row[], f: (r: Row) => number) =>
    round2(arr.reduce((a, r) => a + f(r), 0));

  const count = today.length;
  const gross = sumOf(today, (r) => r.subtotal);
  const discounts = sumOf(today, (r) => r.discount);
  const tax = sumOf(today, (r) => r.tax);
  const tips = sumOf(today, (r) => r.tip);
  const collected = sumOf(today, (r) => r.total);

  const byMethod = (m: string) =>
    sumOf(
      today.filter((r) => r.payment_method === m),
      (r) => r.total
    );
  const cash = byMethod("cash");
  const card = byMethod("card");
  const other = byMethod("other");

  const weekCollected = sumOf(week, (r) => r.total);
  const monthCollected = sumOf(month, (r) => r.total);

  const list = listRows.slice(0, 50);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Totals for today, this week, and this month, plus your recent sales.
          Voided sales are not counted.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
          <span className="text-xs text-muted-foreground">
            {count + (count === 1 ? " sale" : " sales")}
          </span>
        </div>

        <div className="text-3xl font-semibold tabular-nums">
          {money(collected)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">collected</div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Gross</div>
            <div className="tabular-nums">{money(gross)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Discounts</div>
            <div
              className={"tabular-nums " + (discounts > 0 ? "text-red-600" : "")}
            >
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Last 7 days
            </h2>
            <span className="text-xs text-muted-foreground">
              {week.length + (week.length === 1 ? " sale" : " sales")}
            </span>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {money(weekCollected)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">collected</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              This month
            </h2>
            <span className="text-xs text-muted-foreground">
              {month.length + (month.length === 1 ? " sale" : " sales")}
            </span>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {money(monthCollected)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">collected</div>
        </div>
      </div>

      <h2 className="text-sm font-medium text-muted-foreground mb-2">
        Recent sales
      </h2>
      {list.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border">
          {list.map((o) => {
            const voided = o.status === "voided";
            const method =
              o.payment_method.charAt(0).toUpperCase() +
              o.payment_method.slice(1);
            return (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {money(o.total)}
                    {voided && (
                      <span className="ml-2 text-xs text-red-600">Voided</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString() +
                      "  " +
                      "\u00b7" +
                      "  " +
                      method}
                  </div>
                </div>
                <div className="shrink-0">
                  {voided ? (
                    <span className="text-xs text-muted-foreground">
                      {"Ref: " + o.id.slice(0, 8)}
                    </span>
                  ) : (
                    <VoidButton orderId={o.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}