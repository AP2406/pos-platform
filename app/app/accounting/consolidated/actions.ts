"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { accountingSummary, resolvePeriod } from "../data";
import { primeCostSummary } from "../cost";
import { revalidatePath } from "next/cache";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type EntityBook = { businessId: string; name: string; legalEntity: string; netSales: number; cogs: number; labor: number; grossProfit: number; primeCost: number; operatingIncome: number };
export type ConsolidatedResult = { period: string; entities: { entity: string; locations: EntityBook[]; netSales: number; cogs: number; labor: number; operatingIncome: number }[]; locationOptions: { id: string; name: string }[] };

export async function consolidatedBooks(periodKey: string): Promise<ConsolidatedResult> {
  const { business } = await requireBusiness();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const period = resolvePeriod(periodKey || "this_month", tz);
  const supabase = await createClient();

  const mine = (await listBusinesses()).filter((b) => b.role === "owner" || b.role === "manager");
  const ids = mine.map((b) => b.id);
  const { data: bizRows } = await supabase.from("businesses").select("id, name, settings").in("id", ids);
  const metaById = new Map((bizRows ?? []).map((b) => [b.id as string, { name: (b.name as string) || "Location", legal: ((((b.settings ?? {}) as Record<string, unknown>).legal_entity as string | null) || (b.name as string) || "Location") }]));

  const books: EntityBook[] = [];
  for (const b of mine) {
    const s = await accountingSummary(supabase, b.id, period.startIso, period.endIso);
    const pc = await primeCostSummary(supabase, b.id, period.startIso, period.endIso, s.netSales);
    const meta = metaById.get(b.id) ?? { name: b.name, legal: b.name };
    books.push({
      businessId: b.id, name: meta.name, legalEntity: meta.legal,
      netSales: s.netSales, cogs: pc.cogs, labor: pc.laborCost,
      grossProfit: r2(s.netSales - pc.cogs), primeCost: pc.primeCost,
      operatingIncome: r2(s.netSales - pc.cogs - pc.laborCost),
    });
  }

  const byEntity = new Map<string, EntityBook[]>();
  for (const bk of books) {
    const arr = byEntity.get(bk.legalEntity) ?? [];
    arr.push(bk); byEntity.set(bk.legalEntity, arr);
  }
  const entities = Array.from(byEntity.entries()).map(([entity, locations]) => ({
    entity, locations,
    netSales: r2(locations.reduce((s, l) => s + l.netSales, 0)),
    cogs: r2(locations.reduce((s, l) => s + l.cogs, 0)),
    labor: r2(locations.reduce((s, l) => s + l.labor, 0)),
    operatingIncome: r2(locations.reduce((s, l) => s + l.operatingIncome, 0)),
  })).sort((a, b) => b.netSales - a.netSales);

  return { period: period.label, entities, locationOptions: mine.map((b) => ({ id: b.id, name: metaById.get(b.id)?.name ?? b.name })) };
}

async function postEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  userId: string | null,
  entryDate: string,
  memo: string,
  entity: string,
  lines: { account_name: string; account_code: string; debit: number; credit: number }[]
): Promise<boolean> {
  const { data: e, error } = await supabase
    .from("journal_entries")
    .insert({ business_id: businessId, entry_date: entryDate, memo, source: "intercompany", entity, created_by: userId })
    .select("id")
    .single();
  if (error || !e) { console.error("postEntry:", error); return false; }
  const rows = lines.map((l, i) => ({ business_id: businessId, entry_id: e.id as string, account_name: l.account_name, account_code: l.account_code, debit: l.debit, credit: l.credit, sort: i }));
  const { error: lerr } = await supabase.from("journal_lines").insert(rows);
  if (lerr) { console.error("postEntry lines:", lerr); await supabase.from("journal_entries").delete().eq("id", e.id as string); return false; }
  return true;
}

// F11: an inter-location transfer posts a balanced due-from / due-to pair into
// BOTH locations' books (the user must manage both).
export async function postIntercompanyTransfer(input: {
  toBusinessId: string;
  amount: number;
  offsetName?: string;
  offsetCode?: string;
  memo?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can post." };
  const amount = r2(Number(input.amount) || 0);
  if (amount <= 0) return { error: "Enter an amount." };
  if (!input.toBusinessId || input.toBusinessId === business.id) return { error: "Pick a different destination location." };

  const mine = (await listBusinesses()).filter((b) => b.role === "owner" || b.role === "manager");
  const to = mine.find((b) => b.id === input.toBusinessId);
  if (!to) return { error: "You don't manage that location." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const memo = (input.memo || "").trim().slice(0, 200) || "Inter-location transfer";
  const offsetName = (input.offsetName || "Cash").trim().slice(0, 80);
  const offsetCode = (input.offsetCode || "1000").trim().slice(0, 40);
  const fromName = business.name, toName = to.name;

  // From location: cash out, due-from receivable in.
  const ok1 = await postEntry(supabase, business.id, user ? user.id : null, date, memo + " → " + toName, toName, [
    { account_name: "Due from " + toName, account_code: "1300", debit: amount, credit: 0 },
    { account_name: offsetName, account_code: offsetCode, debit: 0, credit: amount },
  ]);
  if (!ok1) return { error: "Could not post the transfer." };
  // To location: cash in, due-to payable.
  const ok2 = await postEntry(supabase, to.id, user ? user.id : null, date, memo + " ← " + fromName, fromName, [
    { account_name: offsetName, account_code: offsetCode, debit: amount, credit: 0 },
    { account_name: "Due to " + fromName, account_code: "2500", debit: 0, credit: amount },
  ]);
  if (!ok2) return { error: "Posted to this location but not the destination — check access." };

  revalidatePath("/app/accounting/consolidated");
  return { ok: true };
}
