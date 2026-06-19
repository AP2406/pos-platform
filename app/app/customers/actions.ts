"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  phone: z.string().max(50).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type CustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export async function createCustomer(
  input: CustomerInput,
  opts?: { force?: boolean }
): Promise<{ ok: true; id: string } | { exists: true; id: string; name: string; on: "email" | "phone" } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  // Dedupe guard: only when a contact field is actually provided (never match on
  // empty/null — walk-ins with no contact info are fine). Email takes priority.
  if (!opts?.force) {
    const email = parsed.data.email?.trim();
    const phone = parsed.data.phone?.trim();
    if (email) {
      const { data: hit } = await supabase
        .from("customers")
        .select("id, name")
        .eq("business_id", business.id)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (hit) return { exists: true, id: hit.id as string, name: hit.name as string, on: "email" };
    }
    if (phone) {
      const { data: hit } = await supabase
        .from("customers")
        .select("id, name")
        .eq("business_id", business.id)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();
      if (hit) return { exists: true, id: hit.id as string, name: hit.name as string, on: "phone" };
    }
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createCustomer:", error);
    return { error: "Could not create customer." };
  }

  revalidatePath("/app/customers");
  return { ok: true, id: data.id };
}

export async function updateCustomer(
  id: string,
  input: CustomerInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("updateCustomer:", error);
    return { error: "Could not update customer." };
  }

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${id}`);
  return { ok: true };
}
// Search other customers in the business (for the merge picker). Excludes the
// "keep" record. Owner/manager only.
export async function listMergeCandidates(
  excludeId: string,
  query: string
): Promise<{ id: string; name: string; phone: string | null; email: string | null }[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  let q = supabase
    .from("customers")
    .select("id, name, phone, email")
    .eq("business_id", business.id)
    .neq("id", excludeId)
    .order("name")
    .limit(20);
  const term = (query || "").trim();
  if (term) q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    email: (c.email as string | null) ?? null,
  }));
}

// Merge `dropId` into `keepId`: reassign every customer_id FK, sum loyalty points
// and store-credit balances (the account rows are unique per customer), append the
// dropped notes, then delete the dropped record. Owner/manager only; audit-logged.
export async function mergeCustomers(
  keepId: string,
  dropId: string
): Promise<{ ok: true; counts: Record<string, number> } | { error: string }> {
  if (!keepId || !dropId) return { error: "Missing customer." };
  if (keepId === dropId) return { error: "Pick a different customer to merge in." };

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can merge customers." };
  }
  const supabase = await createClient();
  const bid = business.id;

  const { data: rows } = await supabase
    .from("customers")
    .select("id, name, notes")
    .eq("business_id", bid)
    .in("id", [keepId, dropId]);
  const keep = (rows ?? []).find((r) => r.id === keepId);
  const drop = (rows ?? []).find((r) => r.id === dropId);
  if (!keep || !drop) return { error: "Both customers must belong to this business." };

  const counts: Record<string, number> = {};
  const countOf = async (table: string) => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("business_id", bid)
      .eq("customer_id", dropId);
    return count ?? 0;
  };

  // Pre-count for the audit trail.
  counts.orders = await countOf("orders");
  counts.loyalty_transactions = await countOf("loyalty_transactions");
  counts.store_credit_ledger = await countOf("store_credit_ledger");

  // 1) Simple reassignments (no unique constraint on these).
  await supabase.from("orders").update({ customer_id: keepId }).eq("business_id", bid).eq("customer_id", dropId);
  await supabase.from("loyalty_transactions").update({ customer_id: keepId }).eq("business_id", bid).eq("customer_id", dropId);
  await supabase.from("store_credit_ledger").update({ customer_id: keepId }).eq("business_id", bid).eq("customer_id", dropId);

  // 2) Loyalty account (unique per business+customer) — sum points.
  {
    const { data: dAcct } = await supabase.from("loyalty_accounts").select("id, points").eq("business_id", bid).eq("customer_id", dropId).maybeSingle();
    if (dAcct) {
      const dropPts = Number(dAcct.points) || 0;
      counts.loyalty_points = dropPts;
      const { data: kAcct } = await supabase.from("loyalty_accounts").select("id, points").eq("business_id", bid).eq("customer_id", keepId).maybeSingle();
      if (kAcct) {
        await supabase.from("loyalty_accounts").update({ points: (Number(kAcct.points) || 0) + dropPts, updated_at: new Date().toISOString() }).eq("id", kAcct.id as string);
        await supabase.from("loyalty_accounts").delete().eq("id", dAcct.id as string);
      } else {
        await supabase.from("loyalty_accounts").update({ customer_id: keepId }).eq("id", dAcct.id as string);
      }
    }
  }

  // 3) Store-credit account (unique per business+customer) — sum balance.
  {
    const { data: dAcct } = await supabase.from("store_credit_accounts").select("id, balance_cents").eq("business_id", bid).eq("customer_id", dropId).maybeSingle();
    if (dAcct) {
      const dropCents = Number(dAcct.balance_cents) || 0;
      counts.store_credit_cents = dropCents;
      const { data: kAcct } = await supabase.from("store_credit_accounts").select("id, balance_cents").eq("business_id", bid).eq("customer_id", keepId).maybeSingle();
      if (kAcct) {
        await supabase.from("store_credit_accounts").update({ balance_cents: (Number(kAcct.balance_cents) || 0) + dropCents, updated_at: new Date().toISOString() }).eq("id", kAcct.id as string);
        await supabase.from("store_credit_accounts").delete().eq("id", dAcct.id as string);
      } else {
        await supabase.from("store_credit_accounts").update({ customer_id: keepId }).eq("id", dAcct.id as string);
      }
    }
  }

  // 4) Append the dropped notes onto the keeper.
  const keepNotes = (keep.notes as string | null) ?? "";
  const dropNotes = (drop.notes as string | null) ?? "";
  if (dropNotes.trim()) {
    const merged = (keepNotes.trim() ? keepNotes.trim() + "\n\n" : "") + "— merged from " + (drop.name as string) + " —\n" + dropNotes.trim();
    await supabase.from("customers").update({ notes: merged.slice(0, 4000) }).eq("id", keepId).eq("business_id", bid);
  }

  // 5) Delete the dropped record (its now-empty account rows / moved ledgers leave nothing to orphan).
  const { error: delErr } = await supabase.from("customers").delete().eq("id", dropId).eq("business_id", bid);
  if (delErr) {
    console.error("mergeCustomers delete:", delErr);
    return { error: "Reassigned the records but could not remove the duplicate. Please retry." };
  }

  // 6) Audit.
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({
    business_id: bid,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: "customer_merge",
    reason_code: "dedupe",
    metadata: {
      keep_id: keepId,
      keep_name: keep.name,
      drop_id: dropId,
      drop_name: drop.name,
      ...counts,
    },
  });

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${keepId}`);
  return { ok: true, counts };
}
