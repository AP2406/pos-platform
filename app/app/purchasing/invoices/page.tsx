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
      .select("id, vendor_id, invoice_number, invoice_date, due_date, subtotal, tax, total, gl_account, attachment_url, status, notes")
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
  }));

  return (
    <div className="max-w-4xl">
      <Link href="/app/purchasing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> Purchasing
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Vendor invoices</h1>
        <p className="text-muted-foreground text-sm mt-1">Record supplier bills, code them to an account, and track what&apos;s outstanding.</p>
      </div>
      <InvoicesClient invoices={invoices} vendors={vendors} currency={currency} canManage={role === "owner" || role === "manager"} />
    </div>
  );
}
