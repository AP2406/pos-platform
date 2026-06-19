import { NextResponse } from "next/server";
import { tipPayrollForRange } from "../tip-actions";

export const dynamic = "force-dynamic";

// Per-employee tip totals over a pay period, for payroll import.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const res = await tipPayrollForRange(from, to);
  if ("error" in res) {
    return new NextResponse(res.error, { status: 400 });
  }

  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
  const n = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
  const out: string[] = [];
  out.push(["Pay period", res.from + " to " + to, "", "", ""].map(esc).join(","));
  out.push([
    res.reportable ? "Tips are payroll-reportable income" : "Tips marked NON-reportable",
    "Split: " + res.method, "", "", "",
  ].map(esc).join(","));
  out.push([""].map(esc).join(","));
  out.push(["Employee", "Tip pool", "Own tips (pre-pool)", "Net sales", "Days worked"].map(esc).join(","));
  for (const e of res.employees) {
    out.push([e.name, n(e.tipPool), n(e.ownTips), n(e.sales), String(e.days)].map(esc).join(","));
  }
  if (res.tipoutsByRole.length > 0) {
    out.push([""].map(esc).join(","));
    out.push(["Tip-outs by role", "", "", "", ""].map(esc).join(","));
    for (const t of res.tipoutsByRole) {
      out.push([t.role, n(t.amount), "", "", ""].map(esc).join(","));
    }
  }
  out.push([""].map(esc).join(","));
  out.push(["Gross tips", n(res.grossTips), "", "", ""].map(esc).join(","));

  const csv = out.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tip-payroll-' + res.from + "_" + to + '.csv"',
    },
  });
}
