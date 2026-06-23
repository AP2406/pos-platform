import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { computePayroll } from "../data";

export const dynamic = "force-dynamic";

// F1/F2 payroll exports. type=t4 (T4 box 14/16/18 figures), roe (hours+earnings),
// feed (provider feed: approved hours + tips). All estimates on deductions.
export async function GET(request: Request) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "t4";
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") || "") ? url.searchParams.get("to")! : new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") || "") ? url.searchParams.get("from")! : new Date(new Date(to + "T00:00:00Z").getTime() - 13 * 86400000).toISOString().slice(0, 10);
  const startIso = new Date(from + "T00:00:00Z").toISOString();
  const endIso = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();

  const supabase = await createClient();
  const rows = await computePayroll(supabase, business.id, startIso, endIso, tz, (business as { settings?: unknown }).settings);

  const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
  const n = (x: number) => (Math.round((Number(x) || 0) * 100) / 100).toFixed(2);
  const out: string[] = [];

  if (type === "roe") {
    // ROE-style: insurable hours + earnings per employee for the period.
    out.push(["Employee", "Period start", "Period end", "Insurable hours", "Insurable earnings (box 14)"].map(esc).join(","));
    for (const r of rows) out.push([r.name, from, to, n(r.regHours + r.otHours), n(r.box14)].map(esc).join(","));
  } else if (type === "feed") {
    // Provider feed: approved hours + tips per pay period.
    out.push(["Employee", "Reg hours", "OT hours", "Pay rate", "Gross wages", "Controlled tips", "Direct tips"].map(esc).join(","));
    for (const r of rows) out.push([r.name, n(r.regHours), n(r.otHours), r.rate == null ? "" : n(r.rate), n(r.grossWages), n(r.controlledTips), n(r.directTips)].map(esc).join(","));
  } else {
    // T4 figures: box 14 employment income (wages + controlled tips), est. CPP (16)
    // and EI (18) — estimates, plus the direct-tips memo (employee-declared).
    out.push(["Employee", "Box 14 employment income", "Controlled tips (in box 14)", "Est. CPP (box 16)", "Est. EI (box 18)", "Direct tips (memo, not on T4)"].map(esc).join(","));
    for (const r of rows) out.push([r.name, n(r.box14), n(r.controlledTips), n(r.estCpp), n(r.estEi), n(r.directTips)].map(esc).join(","));
  }

  const csv = out.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="payroll-' + type + "-" + from + "_" + to + '.csv"',
    },
  });
}
