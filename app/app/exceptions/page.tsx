import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { parseThresholds } from "@/lib/services/exception-thresholds";

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
  if (role !== "owner" && role !== "manager") redirect("/app");
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
    </div>
  );
}
