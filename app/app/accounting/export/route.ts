import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { accountingSummary, resolvePeriod } from "../data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const url = new URL(request.url);
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(url.searchParams.get("period") || "this_month", tz, {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  });
  const supabase = await createClient();
  const s = await accountingSummary(supabase, business.id, period.startIso, period.endIso);

  const esc = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
  const n = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
  const pct = (r: number) => (Math.round(r * 10000) / 100) + "%";
  const row = (section: string, account: string, detail: string, amount: string) =>
    [section, account, detail, amount].map(esc).join(",");

  const lines: string[] = [];
  lines.push(["Section", "Account", "Detail", "Amount"].map(esc).join(","));
  lines.push(row("Period", period.label, business.name, ""));
  lines.push(row("Sales", "Net sales (pre-tax)", "", n(s.netSales)));
  lines.push(row("Sales", "Discounts", "", n(-s.discounts)));
  lines.push(row("Sales", "Comps", "", n(-s.comps)));
  lines.push(row("Sales", "Service charge", "", n(s.serviceCharge)));
  lines.push(row("Sales", "Tips payable", "", n(s.tips)));
  lines.push(row("Sales", "Gross sales", s.orderCount + " sales", n(s.grossSales)));
  for (const t of s.taxByRate) {
    lines.push(row("Tax", t.label + (t.jurisdiction ? " (" + t.jurisdiction + ")" : ""), pct(t.rate) + " on " + n(t.base), n(t.amount)));
  }
  lines.push(row("Tax", "Taxable base", "", n(s.taxableBase)));
  lines.push(row("Tax", "Exempt / zero-rated", "", n(s.exemptBase)));
  lines.push(row("Tax", "Total tax payable", "", n(s.taxTotal)));
  for (const t of s.tenders) {
    lines.push(row("Tender", t.method, "", n(t.amount)));
  }
  lines.push(row("Tender", "Refunds (post-tax)", "", n(-s.refunds)));
  lines.push(row("Void", "Voids (pre-tax)", s.voids.n + " voids", n(s.voids.amount)));
  lines.push(row("Liability", "Gift cards outstanding", "", n(s.giftCardOutstanding)));
  lines.push(row("Liability", "Store credit outstanding", "", n(s.storeCreditOutstanding)));

  const csv = lines.join("\r\n");
  const fname = "accounting-" + period.key + ".csv";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + fname + '"',
    },
  });
}
