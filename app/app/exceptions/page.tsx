import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { parseThresholds } from "@/lib/services/exception-thresholds";
import { weekKey } from "@/lib/services/overtime";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}
function pct(n: number): string {
  return (Math.round(n * 1000) / 10).toFixed(1) + "%";
}

const UNASSIGNED = "__unassigned__";

type Row = {
  staffId: string;
  name: string;
  sales: number;
  orders: number;
  void: { n: number; amt: number };
  comp: { n: number; amt: number };
  discount: { n: number; amt: number };
  refund: { n: number; amt: number };
  reopen: number;
};

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "void");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const range = sp.range === "today" || sp.range === "30d" ? sp.range : "7d";
  const TH = parseThresholds((business as { settings?: Record<string, unknown> }).settings);
  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";

  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const todayKey = dayKey(new Date().toISOString());
  const now = Date.now();
  const inRange = (iso: string) => {
    if (range === "today") return dayKey(iso) === todayKey;
    if (range === "7d") return new Date(iso).getTime() >= now - 7 * 86400000;
    return new Date(iso).getTime() >= now - 30 * 86400000;
  };

  // Sales per staff (denominator of the rates). Voided sales excluded.
  const { data: orderRows } = await supabase
    .from("orders")
    .select("id, total, status, staff_id, created_at")
    .eq("business_id", business.id)
    .neq("status", "voided")
    .gte("created_at", new Date(now - 31 * 86400000).toISOString());

  // Exception events.
  const { data: auditRows } = await supabase
    .from("audit_events")
    .select("action, metadata, created_at")
    .eq("business_id", business.id)
    .gte("created_at", new Date(now - 31 * 86400000).toISOString());

  const rowsByStaff = new Map<string, Row>();
  const ensure = (sid: string | null): Row => {
    const key = sid || UNASSIGNED;
    let r = rowsByStaff.get(key);
    if (!r) {
      r = {
        staffId: key,
        name: key === UNASSIGNED ? "Unassigned" : key,
        sales: 0,
        orders: 0,
        void: { n: 0, amt: 0 },
        comp: { n: 0, amt: 0 },
        discount: { n: 0, amt: 0 },
        refund: { n: 0, amt: 0 },
        reopen: 0,
      };
      rowsByStaff.set(key, r);
    }
    return r;
  };

  for (const o of orderRows ?? []) {
    if (!inRange(o.created_at as string)) continue;
    const r = ensure((o.staff_id as string | null) ?? null);
    r.sales += Number(o.total) || 0;
    r.orders += 1;
  }

  for (const e of auditRows ?? []) {
    if (!inRange(e.created_at as string)) continue;
    const action = (e.action as string) || "";
    const meta = (e.metadata as { amount?: number; staff_id?: string | null } | null) ?? null;
    const amt = meta && typeof meta.amount === "number" ? Number(meta.amount) || 0 : 0;
    const sid = (meta?.staff_id as string | null) ?? null;
    const r = ensure(sid);
    if (action === "void") { r.void.n++; r.void.amt += amt; }
    else if (action === "comp") { r.comp.n++; r.comp.amt += amt; }
    else if (action === "discount") { r.discount.n++; r.discount.amt += amt; }
    else if (action === "refund") { r.refund.n++; r.refund.amt += amt; }
    else if (action === "reopen") { r.reopen++; }
  }

  // C9/C10: longitudinal trend over the last 12 ISO weeks (independent of the
  // range tabs above). One audit query covers both comp/discount/void events and
  // day-close over/short events.
  const TREND_DAYS = 84;
  const { data: trendRows } = await supabase
    .from("audit_events")
    .select("action, metadata, reason_code, created_at")
    .eq("business_id", business.id)
    .in("action", ["comp", "discount", "void", "day_close", "day_close_forced"])
    .gte("created_at", new Date(now - TREND_DAYS * 86400000).toISOString());

  type WeekAgg = { comp: number; discount: number; void: number; compN: number; discN: number; voidN: number; over: number; overN: number };
  const blankWeek = (): WeekAgg => ({ comp: 0, discount: 0, void: 0, compN: 0, discN: 0, voidN: 0, over: 0, overN: 0 });
  const weeks = new Map<string, WeekAgg>();
  const reasonAgg = new Map<string, { amt: number; n: number }>(); // C10 reason-code breakdown
  const cashByStaff = new Map<string, { name: string; over: number; n: number }>(); // C9 over/short by cashier
  for (const e of trendRows ?? []) {
    const wk = weekKey(e.created_at as string, tz);
    const w = weeks.get(wk) ?? blankWeek();
    weeks.set(wk, w);
    const action = (e.action as string) || "";
    const meta = (e.metadata as { amount?: number; over_short?: number; staff_name?: string | null; staff_id?: string | null } | null) ?? null;
    if (action === "comp" || action === "discount" || action === "void") {
      const amt = meta && typeof meta.amount === "number" ? Number(meta.amount) || 0 : 0;
      if (action === "comp") { w.comp += amt; w.compN++; }
      else if (action === "discount") { w.discount += amt; w.discN++; }
      else { w.void += amt; w.voidN++; }
      if (action !== "void") {
        const rc = (e.reason_code as string | null) || "—";
        const ra = reasonAgg.get(rc) ?? { amt: 0, n: 0 };
        ra.amt += amt; ra.n++; reasonAgg.set(rc, ra);
      }
    } else {
      // day_close / day_close_forced → over/short
      const os = meta && typeof meta.over_short === "number" ? Number(meta.over_short) || 0 : 0;
      w.over += os; w.overN++;
      const sid = (meta?.staff_id as string | null) || "__none__";
      const cs = cashByStaff.get(sid) ?? { name: (meta?.staff_name as string | null) || "—", over: 0, n: 0 };
      cs.over += os; cs.n++; if (meta?.staff_name) cs.name = meta.staff_name as string;
      cashByStaff.set(sid, cs);
    }
  }
  const weekKeysSorted = Array.from(weeks.keys()).sort().slice(-12);
  const trendWeeks = weekKeysSorted.map((k) => ({ key: k, ...weeks.get(k)! }));
  const reasonRows = Array.from(reasonAgg.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.amt - a.amt)
    .slice(0, 8);
  const cashRows = Array.from(cashByStaff.values()).filter((c) => c.n > 0).sort((a, b) => Math.abs(b.over) - Math.abs(a.over));
  const cashHasData = cashRows.some((c) => c.n > 0);
  const compDiscHasData = trendWeeks.some((w) => w.compN || w.discN || w.voidN);

  // Resolve staff names.
  const ids = Array.from(rowsByStaff.keys()).filter((k) => k !== UNASSIGNED);
  if (ids.length > 0) {
    const { data: staff } = await supabase
      .from("staff_members")
      .select("id, name")
      .eq("business_id", business.id)
      .in("id", ids);
    for (const s of staff ?? []) {
      const r = rowsByStaff.get(s.id as string);
      if (r) r.name = (s.name as string) || "Staff";
    }
  }

  const rate = (amt: number, sales: number) => (sales > 0 ? amt / sales : 0);
  const flagged = (r: Row) =>
    r.sales > 0 &&
    (rate(r.void.amt, r.sales) > TH.voidRate ||
      rate(r.comp.amt, r.sales) > TH.compRate ||
      rate(r.discount.amt, r.sales) > TH.discountRate ||
      rate(r.refund.amt, r.sales) > TH.refundRate);

  const rows = Array.from(rowsByStaff.values())
    .filter((r) => r.sales > 0 || r.void.n || r.comp.n || r.discount.n || r.refund.n || r.reopen)
    .sort((a, b) => {
      const fa = flagged(a) ? 1 : 0;
      const fb = flagged(b) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return b.void.amt + b.comp.amt + b.discount.amt - (a.void.amt + a.comp.amt + a.discount.amt);
    });

  const totalFlagged = rows.filter(flagged).length;

  const tabs = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Exceptions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Voids, comps, discounts and refunds by employee — as a share of their own sales.
            {totalFlagged > 0 ? ` ${totalFlagged} flagged.` : " Nothing over threshold."}
          </p>
        </div>
        <Link href="/app/reports" className="text-sm text-muted-foreground underline hover:text-foreground shrink-0">
          Reports →
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => {
          const active = range === t.key;
          return (
            <Link
              key={t.key}
              href={"/app/exceptions?range=" + t.key}
              className={
                "text-sm rounded-md px-3 py-1.5 border " +
                (active ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">
          No sales or exceptions in this range.
        </div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Sales</th>
                  <th className="px-3 py-2 font-medium text-right">Voids</th>
                  <th className="px-3 py-2 font-medium text-right">Comps</th>
                  <th className="px-3 py-2 font-medium text-right">Discounts</th>
                  <th className="px-3 py-2 font-medium text-right">Refunds</th>
                  <th className="px-3 py-2 font-medium text-right">Reopens</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isFlag = flagged(r);
                  const cell = (e: { n: number; amt: number }, threshold: number) => {
                    const rt = rate(e.amt, r.sales);
                    const over = r.sales > 0 && rt > threshold;
                    return (
                      <td className={"px-3 py-2 text-right tabular-nums " + (over ? "text-red-600 font-semibold" : "")}>
                        {e.n === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <>
                            {money(e.amt)}
                            <span className="block text-[11px] text-muted-foreground">
                              {e.n}× · {pct(rt)}
                            </span>
                          </>
                        )}
                      </td>
                    );
                  };
                  return (
                    <tr key={r.staffId} className={"border-b border-border last:border-0 " + (isFlag ? "bg-red-500/5" : "")}>
                      <td className="px-3 py-2 font-medium">
                        {isFlag && <span className="mr-1.5 text-red-600">⚠</span>}
                        {r.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(r.sales)}
                        <span className="block text-[11px] text-muted-foreground">{r.orders} sale{r.orders === 1 ? "" : "s"}</span>
                      </td>
                      {cell(r.void, TH.voidRate)}
                      {cell(r.comp, TH.compRate)}
                      {cell(r.discount, TH.discountRate)}
                      {cell(r.refund, TH.refundRate)}
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.reopen === 0 ? <span className="text-muted-foreground">—</span> : r.reopen}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
            Flagged when voids/comps &gt; {pct(TH.voidRate)} or discounts/refunds &gt; {pct(TH.discountRate)} of the employee&apos;s sales.
          </div>
        </div>
      )}

      {/* C10: comp / discount / void trend over the last 12 weeks + reason-code mix */}
      {compDiscHasData && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-1">Comp &amp; discount trend</h2>
          <p className="text-xs text-muted-foreground mb-3">Last 12 weeks, by ISO week (Mon-start). Watch for a climbing baseline.</p>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">Week of</th>
                    <th className="px-3 py-2 font-medium text-right">Comps</th>
                    <th className="px-3 py-2 font-medium text-right">Discounts</th>
                    <th className="px-3 py-2 font-medium text-right">Voids</th>
                  </tr>
                </thead>
                <tbody>
                  {trendWeeks.map((w) => (
                    <tr key={w.key} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{weekLabel(w.key)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{w.compN ? <>{money(w.comp)}<span className="block text-[11px] text-muted-foreground">{w.compN}×</span></> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{w.discN ? <>{money(w.discount)}<span className="block text-[11px] text-muted-foreground">{w.discN}×</span></> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{w.voidN ? <>{money(w.void)}<span className="block text-[11px] text-muted-foreground">{w.voidN}×</span></> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {reasonRows.length > 0 && (
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Top comp/discount reasons (12 wks)</div>
              <div className="space-y-1.5">
                {reasonRows.map((r) => (
                  <div key={r.code} className="flex items-center justify-between text-sm">
                    <span className="truncate">{r.code === "—" ? <span className="text-muted-foreground italic">no reason given</span> : r.code}</span>
                    <span className="tabular-nums shrink-0 ml-3">{money(r.amt)} <span className="text-[11px] text-muted-foreground">· {r.n}×</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* C9: cash over/short trend over the last 12 weeks + by-cashier rollup */}
      {cashHasData && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-1">Cash over / short trend</h2>
          <p className="text-xs text-muted-foreground mb-3">Drawer counts vs expected at day-close. Persistent shorts by one cashier are worth a look.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-medium">Week of</th>
                      <th className="px-3 py-2 font-medium text-right">Closes</th>
                      <th className="px-3 py-2 font-medium text-right">Over / short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendWeeks.filter((w) => w.overN > 0).map((w) => (
                      <tr key={w.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{weekLabel(w.key)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{w.overN}</td>
                        <td className={"px-3 py-2 text-right tabular-nums font-medium " + overClass(w.over)}>{overShort(w.over)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-medium">Cashier</th>
                      <th className="px-3 py-2 font-medium text-right">Closes</th>
                      <th className="px-3 py-2 font-medium text-right">Net over / short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashRows.map((c, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.n}</td>
                        <td className={"px-3 py-2 text-right tabular-nums font-medium " + overClass(c.over)}>{overShort(c.over)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function weekLabel(mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(d);
}
function overShort(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  if (v === 0) return "$0.00";
  return (v > 0 ? "+$" : "−$") + Math.abs(v).toFixed(2);
}
function overClass(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  if (v < 0) return "text-red-600";
  if (v > 0) return "text-emerald-600";
  return "";
}
