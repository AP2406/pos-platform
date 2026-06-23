"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// F4: accrual-vs-cash basis for the books. settings.accounting_basis. Affects
// expense recognition in the income statement + GST34 ITCs (accrual = by invoice
// date; cash = by payment date).
export async function setAccountingBasis(basis: "accrual" | "cash"): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change this." };
  const value = basis === "cash" ? "cash" : "accrual";
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("businesses").update({ settings: { ...current, accounting_basis: value } }).eq("id", business.id);
  if (error) {
    console.error("setAccountingBasis:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/accounting");
  return { ok: true };
}

// F7: a legal-entity name so several locations can roll up to one entity in the
// consolidated books. settings.legal_entity.
export async function setLegalEntity(name: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change this." };
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("businesses").update({ settings: { ...current, legal_entity: (name || "").trim().slice(0, 80) || null } }).eq("id", business.id);
  if (error) return { error: "Could not save." };
  revalidatePath("/app/settings");
  return { ok: true };
}
