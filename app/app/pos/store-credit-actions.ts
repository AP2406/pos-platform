"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P2-33 store credit. Real money in integer cents internally; dollars at the UI.
// Keyed to a customer; every change goes through apply_store_credit_delta so the
// ledger and balance stay reconciled.

export async function getStoreCreditBalance(customerId: string): Promise<number> {
  if (!customerId) return 0;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_credit_accounts")
    .select("balance_cents")
    .eq("business_id", business.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  return data ? (data.balance_cents as number) / 100 : 0;
}

// Manually grant store credit to a customer (owner/manager). Refund-to-credit
// (P2-33b) reuses apply_store_credit_delta with kind 'refund' on the refund path.
export async function issueStoreCredit(
  customerId: string,
  amount: number
): Promise<{ ok: true; balance: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can grant store credit." };
  }
  if (!customerId) return { error: "Choose a customer." };
  const cents = Math.round((Number(amount) || 0) * 100);
  if (cents <= 0) return { error: "Enter an amount." };
  if (cents > 100000000) return { error: "That amount is too large." };

  const supabase = await createClient();
  // Guard: the customer must belong to this business.
  const { data: cust } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!cust) return { error: "Customer not found." };

  const { data: bal, error } = await supabase.rpc("apply_store_credit_delta", {
    p_business_id: business.id,
    p_customer_id: customerId,
    p_delta_cents: cents,
    p_kind: "issue",
    p_order_id: null,
  });
  if (error) {
    console.error("issueStoreCredit:", error);
    return { error: "Could not grant store credit." };
  }
  revalidatePath("/app/customers");
  return { ok: true, balance: (Number(bal) || 0) / 100 };
}
