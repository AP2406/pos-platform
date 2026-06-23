"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// F15 bank-deposit reconciliation. Money numeric dollars.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type DepositRow = {
  id: string;
  businessDate: string;
  expectedCash: number;
  depositedAmount: number;
  depositDate: string | null;
  reference: string | null;
  variance: number;
  status: string;
  note: string | null;
};
export type UndepositedDay = {
  zReportId: string;
  businessDate: string;
  countedCash: number;
  cashSales: number;
  overShort: number;
};

function requireMgr(role: string) {
  return role === "owner" || role === "manager";
}

export async function listDeposits(): Promise<DepositRow[]> {
  const { business, role } = await requireBusiness();
  if (!requireMgr(role)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_deposits")
    .select("id, business_date, expected_cash, deposited_amount, deposit_date, reference, variance, status, note")
    .eq("business_id", business.id)
    .order("business_date", { ascending: false })
    .limit(120);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    businessDate: d.business_date as string,
    expectedCash: Number(d.expected_cash) || 0,
    depositedAmount: Number(d.deposited_amount) || 0,
    depositDate: (d.deposit_date as string | null) ?? null,
    reference: (d.reference as string | null) ?? null,
    variance: Number(d.variance) || 0,
    status: (d.status as string) || "recorded",
    note: (d.note as string | null) ?? null,
  }));
}

// Z-report days that don't yet have a recorded deposit.
export async function listUndepositedDays(): Promise<UndepositedDay[]> {
  const { business, role } = await requireBusiness();
  if (!requireMgr(role)) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [{ data: zs }, { data: deps }] = await Promise.all([
    supabase.from("z_reports").select("id, business_date, totals").eq("business_id", business.id).gte("business_date", since).order("business_date", { ascending: false }),
    supabase.from("bank_deposits").select("business_date").eq("business_id", business.id).gte("business_date", since),
  ]);
  const done = new Set((deps ?? []).map((d) => d.business_date as string));
  return (zs ?? [])
    .filter((z) => !done.has(z.business_date as string))
    .map((z) => {
      const t = (z.totals ?? {}) as Record<string, unknown>;
      return {
        zReportId: z.id as string,
        businessDate: z.business_date as string,
        countedCash: Number(t.counted_cash) || 0,
        cashSales: Number(t.cash_sales) || 0,
        overShort: Number(t.over_short) || 0,
      };
    });
}

export async function recordDeposit(input: {
  businessDate: string;
  zReportId?: string | null;
  expectedCash: number;
  depositedAmount: number;
  depositDate?: string | null;
  reference?: string | null;
  note?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!requireMgr(role)) return { error: "Only an owner or manager can record deposits." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.businessDate)) return { error: "Pick a business day." };
  const expected = r2(Number(input.expectedCash) || 0);
  const deposited = r2(Number(input.depositedAmount) || 0);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("bank_deposits").upsert(
    {
      business_id: business.id,
      business_date: input.businessDate,
      z_report_id: input.zReportId || null,
      expected_cash: expected,
      deposited_amount: deposited,
      deposit_date: input.depositDate || null,
      reference: (input.reference || "").trim().slice(0, 120) || null,
      variance: r2(deposited - expected),
      status: "recorded",
      note: (input.note || "").trim().slice(0, 500) || null,
      created_by: user ? user.id : null,
    },
    { onConflict: "business_id,business_date" }
  );
  if (error) {
    console.error("recordDeposit:", error);
    return { error: "Could not record the deposit." };
  }
  revalidatePath("/app/accounting/deposits");
  return { ok: true };
}

export async function setDepositStatus(id: string, status: "recorded" | "reconciled"): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!requireMgr(role)) return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_deposits").update({ status }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not update." };
  revalidatePath("/app/accounting/deposits");
  return { ok: true };
}

export async function deleteDeposit(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!requireMgr(role)) return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_deposits").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/accounting/deposits");
  return { ok: true };
}
