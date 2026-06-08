import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, SectionHeader } from "../_components/ui";
import { ExpensesPanel } from "./expenses-panel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}

function monthKey(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  return y + "-" + m;
}

export default async function ProfitPage() {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const currency = business.currency || "CAD";
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  const nowKey = monthKey(new Date(), tz);
  let yy = Number(nowKey.split("-")[0]);
  let mm = Number(nowKey.split("-")[1]);
  const months: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const key = String(yy) + "-" + String(mm).padStart(2, "0");
    const label = new Date(yy, mm - 1, 1).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    months.unshift({ key, label });
    mm--;
    if (mm === 0) {
      mm = 12;
      yy--;
    }
  }

  const firstKey = months[0].key;
  const firstY = Number(firstKey.split("-")[0]);
  const firstM = Number(firstKey.split("-")[1]);
  const since = new Date(Date.UTC(firstY, firstM - 1, 1));
  since.setUTCDate(since.getUTCDate() - 2);
  const sinceIso = since.toISOString();
  const sinceDate = firstKey + "-01";

  const [tripsRes, ordersRes, refundsRes, expRes, recentRes] = await Promise.all([
    supabase
      .from("trips")
      .select("scheduled_at, price_total, cookie_amount, handled_by")
      .eq("business_id", business.id)
      .eq("trip_status", "completed")
      .gte("scheduled_at", sinceIso),
    supabase
      .from("orders")
      .select("created_at, subtotal, discount, status, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", sinceIso),
    supabase
      .from("refunds")
      .select("created_at, snapshot")
      .eq("business_id", business.id)
      .gte("created_at", sinceIso),
    supabase
      .from("expenses")
      .select("amount, category, incurred_on")
      .eq("business_id", business.id)
      .gte("incurred_on", sinceDate),
    supabase
      .from("expenses")
      .select("id, amount, category, subcategory, description, incurred_on")
      .eq("business_id", business.id)
      .order("incurred_on", { ascending: false })
      .limit(50),
  ]);

  const revByMonth: Record<string, number> = {};

  // Transportation revenue (trips).
  for (const t of (tripsRes.data ?? []) as Row[]) {
    const k = monthKey(new Date(t.scheduled_at), tz);
    const v =
      t.handled_by === "partner" ? num(t.cookie_amount) : num(t.price_total);
    revByMonth[k] = (revByMonth[k] || 0) + v;
  }

  // POS sales: goods/services revenue (pre-tax, pre-tip), by month.
  for (const o of (ordersRes.data ?? []) as Row[]) {
    if (o.is_training) continue;
    const k = monthKey(new Date(o.created_at), tz);
    revByMonth[k] = (revByMonth[k] || 0) + (num(o.subtotal) - num(o.discount));
  }

  // Subtract refunded goods value in the month the refund occurred.
  for (const r of (refundsRes.data ?? []) as Row[]) {
    const k = monthKey(new Date(r.created_at), tz);
    const snap = (r.snapshot || {}) as { returned_subtotal?: unknown; discount_portion?: unknown };
    const goods = num(snap.returned_subtotal) - num(snap.discount_portion);
    if (goods > 0) revByMonth[k] = (revByMonth[k] || 0) - goods;
  }

  const curKey = months[months.length - 1].key;
  const expByMonth: Record<string, number> = {};
  const expByCategoryCur: Record<string, number> = {};
  for (const e of (expRes.data ?? []) as Row[]) {
    const k = String(e.incurred_on).slice(0, 7);
    expByMonth[k] = (expByMonth[k] || 0) + num(e.amount);
    if (k === curKey) {
      const c = e.category || "Other";
      expByCategoryCur[c] = (expByCategoryCur[c] || 0) + num(e.amount);
    }
  }

  const curRev = revByMonth[curKey] || 0;
  const curExp = expByMonth[curKey] || 0;
  const curProfit = curRev - curExp;
  const curLabel = months[months.length - 1].label;
  const categories = Object.entries(expByCategoryCur).sort((a, b) => b[1] - a[1]);
  const recent = (recentRes.data ?? []) as Row[];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Profit" subtitle="Revenue, expenses, and net profit." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm text-muted-foreground">
            Revenue ({curLabel})
          </div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(curRev)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm text-muted-foreground">Expenses</div>
          <div className="text-2xl font-semibold mt-1">{fmtMoney(curExp)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-sm text-muted-foreground">Net profit</div>
          <div
            className={
              "text-2xl font-semibold mt-1 " +
              (curProfit >= 0 ? "text-emerald-600" : "text-destructive")
            }
          >
            {fmtMoney(curProfit)}
          </div>
        </div>
      </div>

      <SectionHeader>Last 6 months</SectionHeader>
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left font-medium p-3">Month</th>
              <th className="text-right font-medium p-3">Revenue</th>
              <th className="text-right font-medium p-3">Expenses</th>
              <th className="text-right font-medium p-3">Profit</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const r = revByMonth[m.key] || 0;
              const ex = expByMonth[m.key] || 0;
              const p = r - ex;
              return (
                <tr key={m.key} className="border-b border-border last:border-0">
                  <td className="p-3">{m.label}</td>
                  <td className="p-3 text-right">{fmtMoney(r)}</td>
                  <td className="p-3 text-right">{fmtMoney(ex)}</td>
                  <td
                    className={
                      "p-3 text-right font-medium " +
                      (p >= 0 ? "text-emerald-600" : "text-destructive")
                    }
                  >
                    {fmtMoney(p)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {categories.length > 0 ? (
        <>
          <SectionHeader>Expenses by category ({curLabel})</SectionHeader>
          <div className="bg-card border border-border rounded-lg p-5 mb-6 space-y-2">
            {categories.map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span>{cat}</span>
                <span className="font-medium">{fmtMoney(amt)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <SectionHeader>Expenses</SectionHeader>
      <ExpensesPanel
        initialExpenses={recent.map((e) => ({
          id: e.id,
          amount: num(e.amount),
          category: e.category,
          subcategory: e.subcategory,
          description: e.description,
          incurred_on: e.incurred_on,
        }))}
        currency={currency}
      />
    </div>
  );
}