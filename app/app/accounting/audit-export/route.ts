import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { canAccess } from "@/lib/services/route-access";
import { createClient } from "@/lib/supabase/server";
import { trialBalance } from "../year-end/data";

export const dynamic = "force-dynamic";

// F13: full GL-detail / audit register for an external auditor or CRA.
// type=register → every order (sales register incl. void/refund status) + every
// manual journal line. type=tb → the trial balance.
export async function GET(request: Request) {
  const { business, role } = await requireBusiness();
  if (!canAccess(role, "export_data")) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "register";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new NextResponse("Bad range", { status: 400 });
  const startIso = new Date(from + "T00:00:00Z").toISOString();
  const endIso = new Date(new Date(to + "T00:00:00Z").getTime() + 86400000).toISOString();

  const supabase = await createClient();
  const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
  const n = (x: number) => (Math.round((Number(x) || 0) * 100) / 100).toFixed(2);
  const out: string[] = [];
  const settings = (business as { settings?: unknown }).settings;

  if (type === "tb") {
    const tb = await trialBalance(supabase, business.id, startIso, endIso, settings);
    out.push(["Account code", "Account", "Debit", "Credit"].map(esc).join(","));
    let td = 0, tc = 0;
    for (const r of tb) { td += r.debit; tc += r.credit; out.push([r.code, r.account, n(r.debit), n(r.credit)].map(esc).join(",")); }
    out.push(["", "TOTAL", n(td), n(tc)].map(esc).join(","));
  } else {
    // Sales register: every order with its full money + status detail.
    const { data: orders } = await supabase
      .from("orders")
      .select("created_at, sale_number, status, subtotal, tax, tip, discount, comp, service_charge, total, payment_method, staff_id")
      .eq("business_id", business.id)
      .gte("created_at", startIso).lt("created_at", endIso)
      .order("created_at", { ascending: true });
    const staffIds = Array.from(new Set((orders ?? []).map((o) => o.staff_id as string | null).filter((x): x is string => !!x)));
    const staffName = new Map<string, string>();
    if (staffIds.length > 0) {
      const { data: st } = await supabase.from("staff_members").select("id, name").eq("business_id", business.id).in("id", staffIds);
      for (const s of st ?? []) staffName.set(s.id as string, (s.name as string) || "");
    }
    out.push(["Date", "Sale #", "Status", "Subtotal", "Discount", "Comp", "Service charge", "Tax", "Tip", "Total", "Tender", "Staff"].map(esc).join(","));
    for (const o of orders ?? []) {
      out.push([
        (o.created_at as string).slice(0, 19).replace("T", " "), o.sale_number ?? "", (o.status as string) || "",
        n(Number(o.subtotal) || 0), n(Number(o.discount) || 0), n(Number(o.comp) || 0), n(Number(o.service_charge) || 0),
        n(Number(o.tax) || 0), n(Number(o.tip) || 0), n(Number(o.total) || 0), (o.payment_method as string) || "",
        o.staff_id ? (staffName.get(o.staff_id as string) ?? "") : "",
      ].map(esc).join(","));
    }
    // Manual journal entries in the period.
    const { data: entries } = await supabase.from("journal_entries").select("id, entry_date, memo, source").eq("business_id", business.id).gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: true });
    const eids = (entries ?? []).map((e) => e.id as string);
    if (eids.length > 0) {
      const meta = new Map((entries ?? []).map((e) => [e.id as string, { date: e.entry_date as string, memo: (e.memo as string | null) ?? "", source: (e.source as string) || "manual" }]));
      const { data: lines } = await supabase.from("journal_lines").select("entry_id, account_name, account_code, debit, credit, memo").in("entry_id", eids);
      out.push("");
      out.push(["Journal date", "Source", "Account code", "Account", "Debit", "Credit", "Memo"].map(esc).join(","));
      for (const l of lines ?? []) {
        const m = meta.get(l.entry_id as string)!;
        out.push([m.date, m.source, (l.account_code as string | null) ?? "", l.account_name as string, n(Number(l.debit) || 0), n(Number(l.credit) || 0), (l.memo as string | null) ?? m.memo].map(esc).join(","));
      }
    }
  }

  const csv = out.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-' + type + "-" + from + "_" + to + '.csv"',
    },
  });
}
