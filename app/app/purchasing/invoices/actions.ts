"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// C4: vendor invoice (AP) capture. Header-level: vendor, dates, amounts, a GL
// account for posting, payment status, optional PO link + attachment URL.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type InvoiceInput = {
  vendorId?: string | null;
  poId?: string | null;
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal: number;
  tax: number;
  glAccount?: string | null;
  attachmentUrl?: string | null;
  notes?: string | null;
  itcEligible?: boolean;
  expenseCategory?: string | null;
  mealsEntertainment?: boolean;
};

export async function createVendorInvoice(input: InvoiceInput): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can record invoices." };

  const subtotal = r2(Number(input.subtotal) || 0);
  const tax = r2(Number(input.tax) || 0);
  const total = r2(subtotal + tax);
  if (total <= 0 && !(input.invoiceNumber || "").trim()) return { error: "Add an invoice number or an amount." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("vendor_invoices").insert({
    business_id: business.id,
    vendor_id: input.vendorId || null,
    po_id: input.poId || null,
    invoice_number: (input.invoiceNumber || "").trim().slice(0, 120),
    invoice_date: input.invoiceDate || null,
    due_date: input.dueDate || null,
    subtotal,
    tax,
    total,
    gl_account: (input.glAccount || "").trim().slice(0, 120) || null,
    attachment_url: (input.attachmentUrl || "").trim().slice(0, 1000) || null,
    notes: (input.notes || "").trim().slice(0, 1000) || null,
    itc_eligible: input.itcEligible !== false,
    expense_category: (input.expenseCategory || "").trim().slice(0, 80) || null,
    meals_entertainment: input.mealsEntertainment === true,
    status: "open",
    created_by: user ? user.id : null,
  });
  if (error) {
    console.error("createVendorInvoice:", error);
    return { error: "Could not save the invoice." };
  }
  revalidatePath("/app/purchasing/invoices");
  return { ok: true };
}

export async function setInvoiceItc(id: string, itcEligible: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_invoices").update({ itc_eligible: itcEligible }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not update." };
  revalidatePath("/app/purchasing/invoices");
  return { ok: true };
}

export async function setInvoiceStatus(id: string, status: "open" | "paid" | "void"): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("vendor_invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setInvoiceStatus:", error);
    return { error: "Could not update the invoice." };
  }
  revalidatePath("/app/purchasing/invoices");
  return { ok: true };
}

export async function deleteVendorInvoice(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("vendor_invoices").delete().eq("id", id).eq("business_id", business.id);
  if (error) {
    console.error("deleteVendorInvoice:", error);
    return { error: "Could not delete the invoice." };
  }
  revalidatePath("/app/purchasing/invoices");
  return { ok: true };
}
