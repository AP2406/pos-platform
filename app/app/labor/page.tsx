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
      .select("staff_id, total, status, created_at")
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

  // D4: labor target line.
  const ltCfg = ((((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>).labor_target ?? {}) as { enabled?: unknown; targetPct?: unknown };
  const laborTargetPct = ltCfg.enabled === true && Number(ltCfg.targetPct) > 0 ? Number(ltCfg.targetPct) : null;
  const overTarget = laborTargetPct != null && laborPct > laborTargetPct;

  // C3: daypart labor-vs-sales. Sales are bucketed by the local hour of each
  // order; labor is prorated into the same windows by stepping each clock entry
  // in 15-min increments (net of break, prorated across the shift). Labor % per
  // daypart flags the hours where staffing and sales are out of line.
  const DAYPARTS = [
    { key: "morning", label: "Morning", note: "5a–11a", lo: 5, hi: 11 },
    { key: "lunch", label: "Lunch", note: "11a–3p", lo: 11, hi: 15 },
    { key: "afternoon", label: "Afternoon", note: "3p–5p", lo: 15, hi: 17 },
    { key: "dinner", label: "Dinner", note: "5p–10p", lo: 17, hi: 22 },
    { key: "late", label: "Late", note: "10p–5a", lo: 22, hi: 29 },
  ];
  const dpFor = (hour: number) => {
    const h = hour < 5 ? hour + 24 : hour; // wrap small-hours into the "late" band
    return DAYPARTS.find((d) => h >= d.lo && h < d.hi)?.key ?? "late";
  };
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
  const localHour = (ms: number) => parseInt(hourFmt.format(new Date(ms))) % 24;

  const dpSales = new Map<string, number>();
  const dpCost = new Map<string, number>();
  const dpHours = new Map<string, number>();
  for (const o of orders ?? []) {
    const ca = o.created_at as string | null;
    if (!ca || !inRange(ca)) continue;
    const k = dpFor(localHour(new Date(ca).getTime()));
    dpSales.set(k, (dpSales.get(k) ?? 0) + (Number(o.total) || 0));
  }
  const rateById = new Map<string, number | null>();
  for (const s of staff ?? []) rateById.set(s.id as string, s.pay_rate != null ? Number(s.pay_rate) : null);
  const STEP = 15 * 60000;
  for (const c of clocks ?? []) {
    const ci = c.clock_in as string | null;
    if (!ci || !inRange(ci)) continue;
    const inMs = new Date(ci).getTime();
    const outMs = c.clock_out ? new Date(c.clock_out as string).getTime() : now;
    if (outMs <= inMs) continue;
    const shiftMs = outMs - inMs;
    const netFactor = Math.max(0, 1 - ((Number(c.break_minutes) || 0) * 60000) / shiftMs); // spread break across the shift
    const rt = rateById.get(c.staff_id as string) ?? null;
    for (let t = inMs; t < outMs; t += STEP) {
      const seg = Math.min(STEP, outMs - t);
      const hrs = (seg / 3600000) * netFactor;
      const k = dpFor(localHour(t + seg / 2));
      dpHours.set(k, (dpHours.get(k) ?? 0) + hrs);
      if (rt != null) dpCost.set(k, (dpCost.get(k) ?? 0) + hrs * rt);
    }
  }
  const dayparts = DAYPARTS.map((d) => {
    const sales = Math.round((dpSales.get(d.key) ?? 0) * 100) / 100;
    const cost = Math.round((dpCost.get(d.key) ?? 0) * 100) / 100;
    const hours = Math.round((dpHours.get(d.key) ?? 0) * 10) / 10;
    return { ...d, sales, cost, hours, lp: sales > 0 ? (cost / sales) * 100 : null, splh: hours > 0 ? sales / hours : null };
  }).filter((d) => d.sales > 0 || d.hours > 0);

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
        <Stat label="Labor %" value={laborPct.toFixed(1) + "%"} hint={"of " + money(totSales) + (laborTargetPct != null ? " · target " + laborTargetPct + "%" : "")} tone={overTarget ? "bad" : undefined} />
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

      {dayparts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold mb-1">Labor vs sales by daypart</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Where staffing and sales line up across the day. A high labor % flags hours you may be overstaffed; a high sales/labor-hr with low labor % can mean the opposite.
          </p>
          <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-3 py-2 font-medium">Daypart</th>
                    <th className="px-3 py-2 font-medium text-right">Sales</th>
                    <th className="px-3 py-2 font-medium text-right">Labor hrs</th>
                    <th className="px-3 py-2 font-medium text-right">Labor cost</th>
                    <th className="px-3 py-2 font-medium text-right">Labor %</th>
                    <th className="px-3 py-2 font-medium text-right">SPLH</th>
                  </tr>
                </thead>
                <tbody>
                  {dayparts.map((d) => {
                    const lpClass = d.lp == null ? "" : d.lp > 40 ? "text-red-600 font-semibold" : d.lp > 30 ? "text-amber-600 font-medium" : "";
                    return (
                      <tr key={d.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {d.label}
                          <span className="block text-[11px] text-muted-foreground font-normal">{d.note}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(d.sales)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.hours > 0 ? d.hours.toFixed(1) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(d.cost)}</td>
                        <td className={"px-3 py-2 text-right tabular-nums " + lpClass}>{d.lp != null ? d.lp.toFixed(1) + "%" : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.splh != null ? money(d.splh) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "bad" }) {
  return (
    <div className="bg-card ring-1 ring-line shadow-elevation rounded-xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums mt-0.5 " + (tone === "bad" ? "text-red-600" : "")}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
