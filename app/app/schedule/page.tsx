import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { hasFloorService } from "@/lib/modules/modes";
import { ScheduleClient } from "./schedule-client";
import { listShiftTemplates, listTimeOff } from "./actions";
import { todayKey, mondayOf, localMidnightUtc, weekDays, addDays } from "./week";
import { requirePermission } from "@/lib/services/route-access";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { business, role } = await requireBusiness();
  requirePermission(role, "edit_staff");
  if (!hasFloorService(business)) redirect("/app/reports");

  const sp = await searchParams;
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const anchor = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : todayKey(tz);
  const monday = mondayOf(anchor);
  const days = weekDays(monday);
  const nextMonday = addDays(monday, 7);
  const startIso = localMidnightUtc(monday, tz);
  const endIso = localMidnightUtc(nextMonday, tz);

  // Trailing 4 weeks (for a sales forecast) → labor % projection.
  const trailStartIso = localMidnightUtc(addDays(monday, -28), tz);

  const supabase = await createClient();
  const [{ data: staffRows }, { data: shiftRows }, { data: clocks }, { data: trailOrders }] = await Promise.all([
    supabase.from("staff_members").select("id, name, is_active, pay_rate").eq("business_id", business.id).order("name"),
    supabase
      .from("shifts")
      .select("id, staff_id, starts_at, ends_at, role_label, note, published")
      .eq("business_id", business.id)
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at", { ascending: true }),
    supabase
      .from("time_clock_entries")
      .select("staff_id, clock_in, clock_out")
      .eq("business_id", business.id)
      .gte("clock_in", startIso)
      .lt("clock_in", endIso),
    supabase
      .from("orders")
      .select("total")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", trailStartIso)
      .lt("created_at", startIso),
  ]);

  const staff = (staffRows ?? []).map((s) => ({ id: s.id as string, name: (s.name as string) || "Staff", active: s.is_active !== false }));
  const nameById = new Map(staff.map((s) => [s.id, s.name]));
  const rateById = new Map((staffRows ?? []).map((s) => [s.id as string, s.pay_rate != null ? Number(s.pay_rate) : null]));

  const shifts = (shiftRows ?? []).map((s) => {
    const start = s.starts_at as string;
    const end = s.ends_at as string;
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(start));
    const t = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
    const hours = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3600000);
    return {
      id: s.id as string,
      staffId: (s.staff_id as string | null) ?? "",
      staffName: s.staff_id ? nameById.get(s.staff_id as string) ?? "Staff" : "—",
      dayKey,
      timeLabel: t(start) + " – " + t(end),
      roleLabel: (s.role_label as string | null) ?? null,
      note: (s.note as string | null) ?? null,
      published: !!s.published,
      hours: Math.round(hours * 100) / 100,
    };
  });

  // Scheduled vs actual hours per staff for the week.
  const sched = new Map<string, number>();
  for (const s of shifts) sched.set(s.staffId, (sched.get(s.staffId) ?? 0) + s.hours);
  const actual = new Map<string, number>();
  const nowMs = Date.now();
  for (const c of clocks ?? []) {
    const ci = c.clock_in as string;
    const end = c.clock_out ? new Date(c.clock_out as string).getTime() : nowMs;
    const hrs = Math.max(0, (end - new Date(ci).getTime()) / 3600000);
    actual.set(c.staff_id as string, (actual.get(c.staff_id as string) ?? 0) + hrs);
  }
  const variance = staff
    .map((s) => ({
      id: s.id,
      name: s.name,
      scheduled: Math.round((sched.get(s.id) ?? 0) * 10) / 10,
      actual: Math.round((actual.get(s.id) ?? 0) * 10) / 10,
    }))
    .filter((v) => v.scheduled > 0 || v.actual > 0);

  // Labor-cost forecast: scheduled hours × pay rate vs a trailing-average sales
  // forecast for the week. Staff without a pay rate contribute hours but $0 cost.
  let forecastCost = 0;
  let forecastHours = 0;
  let ratedHours = 0;
  for (const s of shifts) {
    forecastHours += s.hours;
    const rate = rateById.get(s.staffId);
    if (rate != null) { forecastCost += s.hours * rate; ratedHours += s.hours; }
  }
  const trailingSales = (trailOrders ?? []).reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const forecastSales = Math.round((trailingSales / 4) * 100) / 100; // avg weekly
  const forecast = {
    cost: Math.round(forecastCost * 100) / 100,
    hours: Math.round(forecastHours * 10) / 10,
    sales: forecastSales,
    laborPct: forecastSales > 0 ? Math.round((forecastCost / forecastSales) * 1000) / 10 : null,
    coverage: forecastHours > 0 ? Math.round((ratedHours / forecastHours) * 100) : 100,
  };

  const templates = await listShiftTemplates();
  const timeOffRaw = await listTimeOff(startIso, endIso);
  const timeOff = timeOffRaw.map((t) => ({ ...t, staffName: nameById.get(t.staffId) ?? "Staff" }));
  const anyUnpublished = shifts.some((s) => !s.published);
  const dayLabels = days.map((d) => ({
    key: d,
    label: new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(d + "T12:00:00Z")),
  }));

  return (
    <ScheduleClient
      staff={staff}
      shifts={shifts}
      days={dayLabels}
      variance={variance}
      monday={monday}
      prevWeek={addDays(monday, -7)}
      nextWeek={nextMonday}
      startIso={startIso}
      endIso={endIso}
      anyUnpublished={anyUnpublished}
      forecast={forecast}
      templates={templates}
      timeOff={timeOff}
    />
  );
}
