import type { createClient } from "@/lib/supabase/server";
import { parseOvertime, weekKey, splitOtHours } from "@/lib/services/overtime";

// F1/F12: statutory-payroll figures per employee for a pay period. Earnings,
// hours (reg/OT), and the controlled-vs-direct tip split that drives T4 box 14.
// CPP/EI here are ESTIMATES (a guide) — a payroll provider computes the exact
// withholding. All money numeric dollars.

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Rough 2024 employee rates — clearly an estimate, not a filing calculation.
const CPP_RATE = 0.0595;
const EI_RATE = 0.0166;

export type PayrollRow = {
  staffId: string;
  name: string;
  regHours: number;
  otHours: number;
  rate: number | null;
  grossWages: number;
  controlledTips: number; // card/electronic — employer-administered → T4 box 14, CPP/EI
  directTips: number;     // cash kept by the server — employee declares, not on T4
  box14: number;          // employment income = gross wages + controlled tips
  estCpp: number;
  estEi: number;
};

export async function computePayroll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  startIso: string,
  endIso: string,
  tz: string,
  settings: unknown
): Promise<PayrollRow[]> {
  const ot = parseOvertime(settings);
  const [{ data: staff }, { data: clocks }, { data: orders }] = await Promise.all([
    supabase.from("staff_members").select("id, name, pay_rate, is_active").eq("business_id", businessId),
    supabase.from("time_clock_entries").select("staff_id, clock_in, clock_out, break_minutes").eq("business_id", businessId).gte("clock_in", startIso).lt("clock_in", endIso),
    supabase.from("orders").select("staff_id, tip, payment_method, status").eq("business_id", businessId).neq("status", "voided").gte("created_at", startIso).lt("created_at", endIso),
  ]);

  type Acc = { name: string; rate: number | null; weeks: Map<string, number>; controlled: number; direct: number };
  const by = new Map<string, Acc>();
  for (const s of staff ?? []) by.set(s.id as string, { name: (s.name as string) || "Staff", rate: s.pay_rate != null ? Number(s.pay_rate) : null, weeks: new Map(), controlled: 0, direct: 0 });

  for (const c of clocks ?? []) {
    const a = by.get(c.staff_id as string);
    if (!a) continue;
    const ci = c.clock_in as string;
    const end = c.clock_out ? new Date(c.clock_out as string).getTime() : Date.now();
    const hrs = Math.max(0, (end - new Date(ci).getTime()) / 3600000 - (Number(c.break_minutes) || 0) / 60);
    a.weeks.set(weekKey(ci, tz), (a.weeks.get(weekKey(ci, tz)) ?? 0) + hrs);
  }
  // F12: controlled = tips on card/electronic tenders; direct = cash tips.
  for (const o of orders ?? []) {
    const a = by.get(o.staff_id as string);
    if (!a) continue;
    const tip = Number(o.tip) || 0;
    if (tip <= 0) continue;
    const m = (o.payment_method as string) || "cash";
    if (m === "cash") a.direct += tip; else a.controlled += tip;
  }

  const rows: PayrollRow[] = [];
  for (const [staffId, a] of by) {
    const { regular, ot: otHrs } = splitOtHours(Array.from(a.weeks.values()), ot.weeklyHours);
    if (regular === 0 && otHrs === 0 && a.controlled === 0 && a.direct === 0) continue;
    const grossWages = a.rate != null ? r2((regular + otHrs * ot.multiplier) * a.rate) : 0;
    const controlled = r2(a.controlled);
    const box14 = r2(grossWages + controlled);
    rows.push({
      staffId, name: a.name,
      regHours: Math.round(regular * 100) / 100, otHours: Math.round(otHrs * 100) / 100, rate: a.rate,
      grossWages, controlledTips: controlled, directTips: r2(a.direct), box14,
      estCpp: r2(box14 * CPP_RATE), estEi: r2(box14 * EI_RATE),
    });
  }
  return rows.sort((x, y) => y.box14 - x.box14);
}
