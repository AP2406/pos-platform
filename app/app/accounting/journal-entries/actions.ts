"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { lockedThrough } from "@/lib/services/period-lock";
import { revalidatePath } from "next/cache";

// F8 general journal + recurring/auto-reversing templates. Double-entry: every
// entry must balance (sum debits = sum credits). Numeric dollars.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type JLine = { account_name: string; account_code: string | null; debit: number; credit: number; memo: string | null };
export type JEntry = { id: string; entryDate: string; memo: string | null; source: string; entity: string | null; reversesId: string | null; lines: JLine[]; debit: number; credit: number };
export type JTemplate = { id: string; name: string; memo: string | null; autoReverse: boolean; lines: JLine[] };

function cleanLines(raw: unknown): JLine[] {
  if (!Array.isArray(raw)) return [];
  const out: JLine[] = [];
  for (const l of raw.slice(0, 100)) {
    const o = (l ?? {}) as Record<string, unknown>;
    const name = String(o.account_name ?? "").trim().slice(0, 120);
    const debit = r2(Number(o.debit) || 0);
    const credit = r2(Number(o.credit) || 0);
    if (!name || (debit === 0 && credit === 0)) continue;
    out.push({ account_name: name, account_code: (String(o.account_code ?? "").trim().slice(0, 40)) || null, debit, credit, memo: (String(o.memo ?? "").trim().slice(0, 200)) || null });
  }
  return out;
}
function balanced(lines: JLine[]): { ok: boolean; debit: number; credit: number } {
  const debit = r2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = r2(lines.reduce((s, l) => s + l.credit, 0));
  return { ok: lines.length >= 2 && debit > 0 && Math.abs(debit - credit) < 0.005, debit, credit };
}

export async function listJournalEntries(limit = 100): Promise<JEntry[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, entry_date, memo, source, entity, reverses_id")
    .eq("business_id", business.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  const ids = (entries ?? []).map((e) => e.id as string);
  const linesByEntry = new Map<string, JLine[]>();
  if (ids.length > 0) {
    const { data: lines } = await supabase
      .from("journal_lines")
      .select("entry_id, account_name, account_code, debit, credit, memo, sort")
      .in("entry_id", ids)
      .order("sort", { ascending: true });
    for (const l of lines ?? []) {
      const arr = linesByEntry.get(l.entry_id as string) ?? [];
      arr.push({ account_name: l.account_name as string, account_code: (l.account_code as string | null) ?? null, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: (l.memo as string | null) ?? null });
      linesByEntry.set(l.entry_id as string, arr);
    }
  }
  return (entries ?? []).map((e) => {
    const lines = linesByEntry.get(e.id as string) ?? [];
    return {
      id: e.id as string,
      entryDate: e.entry_date as string,
      memo: (e.memo as string | null) ?? null,
      source: (e.source as string) || "manual",
      entity: (e.entity as string | null) ?? null,
      reversesId: (e.reverses_id as string | null) ?? null,
      lines,
      debit: r2(lines.reduce((s, l) => s + l.debit, 0)),
      credit: r2(lines.reduce((s, l) => s + l.credit, 0)),
    };
  });
}

async function insertEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  userId: string | null,
  input: { entryDate: string; memo: string | null; entity: string | null; source: string; templateId?: string | null; reversesId?: string | null; lines: JLine[] }
): Promise<string | null> {
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({ business_id: businessId, entry_date: input.entryDate, memo: input.memo, source: input.source, template_id: input.templateId ?? null, reverses_id: input.reversesId ?? null, entity: input.entity, created_by: userId })
    .select("id")
    .single();
  if (error || !entry) { console.error("insertEntry:", error); return null; }
  const eid = entry.id as string;
  const rows = input.lines.map((l, i) => ({ business_id: businessId, entry_id: eid, account_name: l.account_name, account_code: l.account_code, debit: l.debit, credit: l.credit, memo: l.memo, sort: i }));
  const { error: lerr } = await supabase.from("journal_lines").insert(rows);
  if (lerr) { console.error("insertEntry lines:", lerr); await supabase.from("journal_entries").delete().eq("id", eid); return null; }
  return eid;
}

function firstOfNextMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export async function createJournalEntry(input: {
  entryDate: string;
  memo?: string | null;
  entity?: string | null;
  autoReverse?: boolean;
  source?: string;
  templateId?: string | null;
  lines: JLine[];
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can post entries." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) return { error: "Pick an entry date." };
  const lines = cleanLines(input.lines);
  const b = balanced(lines);
  if (!b.ok) return { error: "Entry must have ≥2 lines and balance (debits = credits)." };

  const supabase = await createClient();
  const locked = await lockedThrough(supabase, business.id);
  if (locked && input.entryDate <= locked) return { error: "That period is locked (through " + locked + ")." };

  const { data: { user } } = await supabase.auth.getUser();
  const eid = await insertEntry(supabase, business.id, user ? user.id : null, {
    entryDate: input.entryDate, memo: (input.memo || "").trim().slice(0, 300) || null, entity: (input.entity || "").trim().slice(0, 80) || null,
    source: input.source || "manual", templateId: input.templateId ?? null, lines,
  });
  if (!eid) return { error: "Could not post the entry." };

  // Auto-reversing: book the flipped entry on the first of the next month.
  if (input.autoReverse) {
    const flipped = lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));
    await insertEntry(supabase, business.id, user ? user.id : null, {
      entryDate: firstOfNextMonth(input.entryDate), memo: "Auto-reversal: " + ((input.memo || "").trim().slice(0, 280) || "entry"), entity: (input.entity || "").trim().slice(0, 80) || null,
      source: input.source || "manual", reversesId: eid, lines: flipped,
    });
  }
  revalidatePath("/app/accounting/journal-entries");
  return { ok: true };
}

export async function deleteJournalEntry(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("journal_entries").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/accounting/journal-entries");
  return { ok: true };
}

// --- Templates ---
export async function listJournalTemplates(): Promise<JTemplate[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  const { data } = await supabase.from("journal_templates").select("id, name, memo, auto_reverse, lines").eq("business_id", business.id).order("created_at", { ascending: false });
  return (data ?? []).map((t) => ({ id: t.id as string, name: (t.name as string) || "Template", memo: (t.memo as string | null) ?? null, autoReverse: t.auto_reverse === true, lines: cleanLines(t.lines) }));
}

export async function createJournalTemplate(input: { name: string; memo?: string | null; autoReverse?: boolean; lines: JLine[] }): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const name = (input.name || "").trim().slice(0, 80);
  if (!name) return { error: "Name the template." };
  const lines = cleanLines(input.lines);
  if (lines.length < 2) return { error: "Add at least two lines." };
  const supabase = await createClient();
  const { error } = await supabase.from("journal_templates").insert({ business_id: business.id, name, memo: (input.memo || "").trim().slice(0, 300) || null, auto_reverse: input.autoReverse === true, lines });
  if (error) return { error: "Could not save the template." };
  revalidatePath("/app/accounting/journal-entries");
  return { ok: true };
}

export async function deleteJournalTemplate(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("journal_templates").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/accounting/journal-entries");
  return { ok: true };
}

export async function postTemplate(templateId: string, entryDate: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { data: t } = await supabase.from("journal_templates").select("name, memo, auto_reverse, lines").eq("id", templateId).eq("business_id", business.id).maybeSingle();
  if (!t) return { error: "Template not found." };
  return createJournalEntry({
    entryDate, memo: (t.memo as string | null) || (t.name as string), autoReverse: t.auto_reverse === true,
    source: "template", templateId, lines: cleanLines(t.lines),
  });
}
