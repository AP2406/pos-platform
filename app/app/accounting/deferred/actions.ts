"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { lockedThrough } from "@/lib/services/period-lock";
import { revalidatePath } from "next/cache";

// F14 deferred revenue + F6 gift-card breakage. Each posts a balanced journal
// entry into the F8 journal. Numeric dollars.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

type JLine = { account_name: string; account_code: string; debit: number; credit: number };

async function postEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  userId: string | null,
  entryDate: string,
  memo: string,
  source: string,
  lines: JLine[]
): Promise<{ id: string } | { error: string }> {
  const locked = await lockedThrough(supabase, businessId);
  if (locked && entryDate <= locked) return { error: "That period is locked (through " + locked + ")." };
  const { data: e, error } = await supabase
    .from("journal_entries")
    .insert({ business_id: businessId, entry_date: entryDate, memo, source, created_by: userId })
    .select("id")
    .single();
  if (error || !e) { console.error("postEntry:", error); return { error: "Could not post the journal entry." }; }
  const rows = lines.map((l, i) => ({ business_id: businessId, entry_id: e.id as string, account_name: l.account_name, account_code: l.account_code, debit: l.debit, credit: l.credit, sort: i }));
  const { error: lerr } = await supabase.from("journal_lines").insert(rows);
  if (lerr) { await supabase.from("journal_entries").delete().eq("id", e.id as string); return { error: "Could not post the journal entry." }; }
  return { id: e.id as string };
}

export type DeferredRow = { id: string; description: string; customerName: string | null; amount: number; receivedDate: string | null; eventDate: string | null; status: string };

export async function listDeferred(): Promise<DeferredRow[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("deferred_revenue")
    .select("id, description, customer_name, amount, received_date, event_date, status")
    .eq("business_id", business.id)
    .order("event_date", { ascending: true })
    .limit(200);
  return (data ?? []).map((d) => ({
    id: d.id as string, description: (d.description as string) || "", customerName: (d.customer_name as string | null) ?? null,
    amount: Number(d.amount) || 0, receivedDate: (d.received_date as string | null) ?? null, eventDate: (d.event_date as string | null) ?? null,
    status: (d.status as string) || "deferred",
  }));
}

export async function recordDeferred(input: { description: string; customerName?: string | null; amount: number; receivedDate?: string | null; eventDate?: string | null; note?: string | null }): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can record this." };
  const amount = r2(Number(input.amount) || 0);
  if (amount <= 0) return { error: "Enter an amount." };
  if (!(input.description || "").trim()) return { error: "Add a description." };
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const received = /^\d{4}-\d{2}-\d{2}$/.test(input.receivedDate || "") ? input.receivedDate! : new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Deferral entry: cash in, deferred-revenue liability up.
  const res = await postEntry(supabase, business.id, user ? user.id : null, received, "Deferred: " + input.description.trim().slice(0, 120), "deferred", [
    { account_name: "Cash", account_code: "1000", debit: amount, credit: 0 },
    { account_name: "Deferred revenue", account_code: "2600", debit: 0, credit: amount },
  ]);
  if ("error" in res) return res;

  const { error } = await supabase.from("deferred_revenue").insert({
    business_id: business.id, description: input.description.trim().slice(0, 200), customer_name: (input.customerName || "").trim().slice(0, 120) || null,
    amount, received_date: received, event_date: input.eventDate || null, status: "deferred", journal_entry_id: res.id,
    note: (input.note || "").trim().slice(0, 500) || null, created_by: user ? user.id : null,
  });
  if (error) { console.error("recordDeferred:", error); return { error: "Posted the entry but could not save the record." }; }
  revalidatePath("/app/accounting/deferred");
  return { ok: true };
}

export async function releaseDeferred(id: string, releaseDate?: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { data: d } = await supabase.from("deferred_revenue").select("description, amount, event_date, status").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!d) return { error: "Not found." };
  if ((d.status as string) !== "deferred") return { error: "Already " + (d.status as string) + "." };
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(releaseDate || "") ? releaseDate! : (d.event_date as string | null) || new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const amount = r2(Number(d.amount) || 0);

  const { data: { user } } = await supabase.auth.getUser();
  // Release entry: deferred-revenue liability down, sales up.
  const res = await postEntry(supabase, business.id, user ? user.id : null, date, "Released: " + (d.description as string).slice(0, 120), "deferred", [
    { account_name: "Deferred revenue", account_code: "2600", debit: amount, credit: 0 },
    { account_name: "Food & beverage sales", account_code: "4000", debit: 0, credit: amount },
  ]);
  if ("error" in res) return res;
  await supabase.from("deferred_revenue").update({ status: "released", released_at: new Date().toISOString(), release_entry_id: res.id }).eq("id", id).eq("business_id", business.id);
  revalidatePath("/app/accounting/deferred");
  return { ok: true };
}

export async function deleteDeferred(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("deferred_revenue").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/accounting/deferred");
  return { ok: true };
}

// --- F6 gift-card breakage ---
export type BreakageInfo = { agedBalance: number; rate: number; ageMonths: number; suggested: number };

export async function giftBreakageInfo(): Promise<BreakageInfo> {
  const { business } = await requireBusiness();
  const cfg = (((business as { settings?: Record<string, unknown> }).settings ?? {}).gift_breakage ?? {}) as { rate?: number; ageMonths?: number };
  const rate = Number(cfg.rate) > 0 ? Number(cfg.rate) : 100; // % of aged balance to recognize
  const ageMonths = Number(cfg.ageMonths) > 0 ? Number(cfg.ageMonths) : 24;
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - ageMonths * 30 * 86400000).toISOString();
  const { data } = await supabase.from("gift_cards").select("balance_cents, updated_at").eq("business_id", business.id).eq("is_active", true).gt("balance_cents", 0).lt("updated_at", cutoff);
  let agedBalance = 0;
  for (const g of data ?? []) agedBalance += (Number(g.balance_cents) || 0) / 100;
  agedBalance = r2(agedBalance);
  return { agedBalance, rate, ageMonths, suggested: r2(agedBalance * (rate / 100)) };
}

export async function setGiftBreakageConfig(rate: number, ageMonths: number): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("businesses").update({ settings: { ...current, gift_breakage: { rate: Math.min(100, Math.max(0, Number(rate) || 0)), ageMonths: Math.max(1, Math.round(Number(ageMonths) || 24)) } } }).eq("id", business.id);
  if (error) return { error: "Could not save." };
  revalidatePath("/app/accounting/deferred");
  return { ok: true };
}

export async function recognizeBreakage(amount: number): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const amt = r2(Number(amount) || 0);
  if (amt <= 0) return { error: "Enter an amount." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const res = await postEntry(supabase, business.id, user ? user.id : null, date, "Gift-card breakage recognized", "breakage", [
    { account_name: "Gift card liability", account_code: "2400", debit: amt, credit: 0 },
    { account_name: "Gift card breakage income", account_code: "4800", debit: 0, credit: amt },
  ]);
  if ("error" in res) return res;
  revalidatePath("/app/accounting/deferred");
  return { ok: true };
}
