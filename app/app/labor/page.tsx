import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { listTimesheet } from "../clock/time-actions";
import { TimesheetEditor } from "./timesheet-editor";
import { parseOvertime, weekKey, splitOtHours } from "@/lib/services/overtime";

export const dynamic = "force-dynamic";

function money(n: number): string {
  return "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

type Row = { id: string; name: string; hours: number; ot: number; rate: number | null; cost: number; sales: number };

export default async function LaborPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") redirect("/app");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const range = sp.range === "today" || sp.range === "30d" ? sp.range : "7d";
  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const now = Date.now();

  const dayKey = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const todayKey = dayKey(new Date().toISOString());
  const inRange = (iso: string) => {
    if (range === "today") return dayKey(iso) === todayKey;
    if (range === "7d") return new Date(iso).getTime() >= now - 7 * 86400000;
    return new Date(iso).getTime() >= now - 30 * 86400000;
  };

  const [{ data: staff }, { data: clocks }, { data: orders }] = await Promise.all([
    supabase.from("staff_members").select("id, name, pay_rate, is_active").eq("business_id", business.id),
    supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out, break_minutes")
      .eq("business_id", business.id)
      .gte("clock_in", new Date(now - 31 * 86400000).toISOString()),
    supabase
      .from("orders")
      .select("staff_id, total, status")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", new Date(now - 31 * 86400000).toISOString()),
  ]);

  const otCfg = parseOvertime((business as { settings?: unknown }).settings);

  const byId = new Map<string, Row>();
  for (const s of staff ?? []) {
    byId.set(s.id as string, {
      id: s.id as string,
      name: (s.name as string) || "Staff",
      hours: 0,
      ot: 0,
      rate: s.pay_rate != null ? Number(s.pay_rate) : null,
      cost: 0,
      sales: 0,
    });
  }

  // Per-employee hours bucketed by ISO week, so overtime (over the weekly
  // threshold) is computed per week and costed at the OT multiplier.
  const weeksByStaff = new Map<string, Map<string, number>>();
  for (const c of clocks ?? []) {
    const ci = c.clock_in as string;
    if (!ci || !inRange(ci)) continue;
    const r = byId.get(c.staff_id as string);
    if (!r) continue;
    const end = c.clock_out ? new Date(c.clock_out as string).getTime() : now;
    const hrs = Math.max(0, (end - new Date(ci).getTime()) / 3600000 - (Number(c.break_minutes) || 0) / 60);
    r.hours += hrs;
    let wm = weeksByStaff.get(r.id);
    if (!wm) { wm = new Map(); weeksByStaff.set(r.id, wm); }
    wm.set(weekKey(ci, tz), (wm.get(weekKey(ci, tz)) ?? 0) + hrs);
  }
  for (const o of orders ?? []) {
    if (!o.staff_id) continue;
    const r = byId.get(o.staff_id as string);
    if (!r) continue;
    r.sales += Number(o.total) || 0;
  }

  const rows = Array.from(byId.values())
    .map((r) => {
      const wm = weeksByStaff.get(r.id);
      const { regular, ot } = splitOtHours(wm ? Array.from(wm.values()) : [], otCfg.weeklyHours);
      const cost = r.rate ? (regular + ot * otCfg.multiplier) * r.rate : 0;
      return { ...r, hours: Math.round(r.hours * 100) / 100, ot, cost: Math.round(cost * 100) / 100, sales: Math.round(r.sales * 100) / 100 };
    })
    .filter((r) => r.hours > 0 || r.sales > 0)
    .sort((a, b) => b.cost - a.cost);

  const totHours = rows.reduce((s, r) => s + r.hours, 0);
  const totOt = rows.reduce((s, r) => s + r.ot, 0);
  const totCost = rows.reduce((s, r) => s + r.cost, 0);
  const totSales = rows.reduce((s, r) => s + r.sales, 0);
  const laborPct = totSales > 0 ? (totCost / totSales) * 100 : 0;
  const splh = totHours > 0 ? totSales / totHours : 0;

  const timesheet = await listTimesheet();

  const tabs = [
    { key: "today", label: "Today" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
  ];

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Labor</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hours, labor cost and productivity by employee. Set pay rates under Team.
          </p>
        </div>
        <Link href="/app/reports" className="text-sm text-muted-foreground underline hover:text-foreground shrink-0">Reports →</Link>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <Link key={t.key} href={"/app/labor?range=" + t.key}
            className={"text-sm rounded-md px-3 py-1.5 border " + (range === t.key ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent")}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Labor cost" value={money(totCost)} />
        <Stat label="Labor %" value={laborPct.toFixed(1) + "%"} hint={"of " + money(totSales)} />
        <Stat label="Sales / labor hr" value={money(splh)} />
        <Stat label="Hours" value={(Math.round(totHours * 10) / 10).toFixed(1)} hint={totOt > 0 ? totOt.toFixed(1) + " OT @ " + otCfg.multiplier + "× over " + otCfg.weeklyHours + "h/wk" : undefined} />
      </div>

      {rows.length === 0 ? (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-8 text-center text-muted-foreground">No clocked hours or sales in this range.</div>
      ) : (
        <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Hours</th>
                  <th className="px-3 py-2 font-medium text-right">OT</th>
                  <th className="px-3 py-2 font-medium text-right">Rate</th>
                  <th className="px-3 py-2 font-medium text-right">Cost</th>
                  <th className="px-3 py-2 font-medium text-right">Sales</th>
                  <th className="px-3 py-2 font-medium text-right">Labor %</th>
                  <th className="px-3 py-2 font-medium text-right">SPLH</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const lp = r.sales > 0 ? (r.cost / r.sales) * 100 : 0;
                  const sp_ = r.hours > 0 ? r.sales / r.hours : 0;
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">
                        {r.name}
                        {r.ot > 0 && <span className="ml-2 text-xs text-amber-600 font-semibold">OT</span>}
                        {r.rate == null && <span className="ml-2 text-xs text-muted-foreground">no rate</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.ot > 0 ? r.ot.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.rate != null ? money(r.rate) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.sales)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.sales > 0 && r.cost > 0 ? lp.toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.hours > 0 ? money(sp_) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-semibold mb-1">Timesheets</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Last two weeks. Edit a punch to fix a missed clock-out or correct a break — changes are logged to the audit trail.
        </p>
        <TimesheetEditor entries={timesheet} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
