"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// House accounts (accounts receivable). Money in integer cents internally; dollars
// at the UI. Balance = amount the customer OWES. Charges are applied on the sale
// path (createOrder → apply_house_account_delta 'charge'); this file covers the
// read used by the register and the manage/settle actions on the customer page.

export type HouseAccount = { enabled: boolean; balance: number; limit: number | null };

// Read a customer's house account for the register (enabled + balance + limit).
export async function getHouseAccount(customerId: string): Promise<HouseAccount | null> {
  if (!customerId) return null;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("house_accounts")
    .select("enabled, balance_cents, limit_cents")
    .eq("business_id", business.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (!data) return null;
  return {
    enabled: data.enabled === true,
    balance: (Number(data.balance_cents) || 0) / 100,
    limit: data.limit_cents == null ? null : (Number(data.limit_cents) || 0) / 100,
  };
}

// Enable/disable a customer's house account and set an optional credit limit
// (owner/manager). Creates the account row on first enable.
export async function setHouseAccount(
  customerId: string,
  enabled: boolean,
  limitDollars: number | null
): Promise<{ ok: true; balance: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can manage house accounts." };
  }
  if (!customerId) return { error: "Choose a customer." };
  const limitCents =
    limitDollars == null || !Number.isFinite(limitDollars) || limitDollars <= 0
      ? null
      : Math.round(limitDollars * 100);
  if (limitCents != null && limitCents > 100_000_000) return { error: "That limit is too large." };

  const supabase = await createClient();
  // Guard: the customer must belong to this business.
  const { data: cust } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!cust) return { error: "Customer not found." };

  const { data: existing } = await supabase
    .from("house_accounts")
    .select("id, balance_cents")
    .eq("business_id", business.id)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("house_accounts")
      .update({ enabled, limit_cents: limitCents, updated_at: new Date().toISOString() })
      .eq("id", existing.id as string);
    if (error) { console.error("setHouseAccount update:", error); return { error: "Could not save the house account." }; }
    revalidatePath("/app/customers");
    revalidatePath("/app/customers/" + customerId);
    return { ok: true, balance: (Number(existing.balance_cents) || 0) / 100 };
  }

  const { error } = await supabase
    .from("house_accounts")
    .insert({ business_id: business.id, customer_id: customerId, enabled, limit_cents: limitCents, balance_cents: 0 });
  if (error) { console.error("setHouseAccount insert:", error); return { error: "Could not create the house account." }; }
  revalidatePath("/app/customers");
  revalidatePath("/app/customers/" + customerId);
  return { ok: true, balance: 0 };
}

// Record a payment against a customer's house account (reduces the balance owed).
// The AR ledger is the source of truth for the outstanding balance.
export async function settleHouseAccount(
  customerId: string,
  amountDollars: number,
  note?: string
): Promise<{ ok: true; balance: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can record a house-account payment." };
  }
  if (!customerId) return { error: "Choose a customer." };
  const cents = Math.round((Number(amountDollars) || 0) * 100);
  if (cents <= 0) return { error: "Enter a payment amount." };
  if (cents > 100_000_000) return { error: "That amount is too large." };

  const supabase = await createClient();
  const { data: acct } = await supabase
    .from("house_accounts")
    .select("balance_cents")
    .eq("business_id", business.id)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (!acct) return { error: "This customer has no house account." };
  const balance = (Number(acct.balance_cents) || 0);
  if (cents > balance) return { error: "Payment is more than the balance owed." };

  const { data: newBal, error } = await supabase.rpc("apply_house_account_delta", {
    p_business_id: business.id,
    p_customer_id: customerId,
    p_delta_cents: -cents,
    p_kind: "payment",
    p_order_id: null,
    p_note: (note || "").slice(0, 200) || null,
  });
  if (error) { console.error("settleHouseAccount:", error); return { error: "Could not record the payment." }; }
  revalidatePath("/app/customers");
  revalidatePath("/app/customers/" + customerId);
  revalidatePath("/app/accounting");
  return { ok: true, balance: (Number(newBal) || 0) / 100 };
}
