import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { ChevronLeft } from "lucide-react";
import { InvoicesClient, type Invoice } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();

  const [{ data: invRows }, { data: vendorRows }, { data: bizRow }] = await Promise.all([
    supabase
      .from("vendor_invoices")
      .select("id, vendor_id, invoice_number, invoice_date, due_date, subtotal, tax, total, gl_account, attachment_url, status, notes, itc_eligible")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false }),
    supabase.from("vendors").select("id, name").eq("business_id", business.id).eq("is_active", true).order("name", { ascending: true }),
    supabase.from("businesses").select("currency").eq("id", business.id).maybeSingle(),
  ]);

  const vendors = (vendorRows ?? []).map((v) => ({ id: v.id as string, name: v.name as string }));
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const currency = ((bizRow?.currency as string) || "USD").toUpperCase();

  const invoices: Invoice[] = (invRows ?? []).map((i) => ({
    id: i.id as string,
    vendorName: i.vendor_id ? vendorName.get(i.vendor_id as string) ?? null : null,
    invoice_number: (i.invoice_number as string) || "",
    invoice_date: (i.invoice_date as string | null) ?? null,
    due_date: (i.due_date as string | null) ?? null,
    subtotal: Number(i.subtotal) || 0,
    tax: Number(i.tax) || 0,
    total: Number(i.total) || 0,
    gl_account: (i.gl_account as string | null) ?? null,
    attachment_url: (i.attachment_url as string | null) ?? null,
    status: (i.status as string) || "open",
    notes: (i.notes as string | null) ?? null,
    itc_eligible: (i as { itc_eligible?: boolean }).itc_eligible !== false,
  }));

  // F3: AP aging — open invoices bucketed by days past due (due date, else
  // invoice date). Numeric dollars.
  const now = Date.now();
  const aging = { current: 0, b30: 0, b60: 0, b90: 0, over: 0, total: 0 };
  for (const i of invoices) {
    if (i.status !== "open") continue;
    const ref = i.due_date || i.invoice_date;
    const daysPast = ref ? Math.floor((now - new Date(ref + "T00:00:00").getTime()) / 86400000) : 0;
    aging.total += i.total;
    if (daysPast <= 0) aging.current += i.total;
    else if (daysPast <= 30) aging.b30 += i.total;
    else if (daysPast <= 60) aging.b60 += i.total;
    else if (daysPast <= 90) aging.b90 += i.total;
    else aging.over += i.total;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const agingRounded = { current: r2(aging.current), b30: r2(aging.b30), b60: r2(aging.b60), b90: r2(aging.b90), over: r2(aging.over), total: r2(aging.total) };

  return (
    <div className="max-w-4xl">
      <Link href="/app/purchasing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Purchasing
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Vendor invoices</h1>
        <p className="text-muted-foreground text-sm mt-1">Record supplier bills, code them to an account, and track what&apos;s outstanding.</p>
      </div>
      <InvoicesClient invoices={invoices} vendors={vendors} currency={currency} canManage={role === "owner" || role === "manager"} aging={agingRounded} />
    </div>
  );
}
