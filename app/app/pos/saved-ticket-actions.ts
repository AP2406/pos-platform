"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

// E4/E7 saved tickets. Lines are a trimmed snapshot of cart lines, re-added on
// tap. Money stays numeric dollars; quantities/prices validated on save.
export type SavedLine = {
  catalog_item_id: string | null;
  variation_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  taxable: boolean;
  note: string | null;
  allergy: string | null;
  course_id: string | null;
};
export type SavedTicket = { id: string; name: string; scope: string; lines: SavedLine[] };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function cleanLines(raw: unknown): SavedLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedLine[] = [];
  for (const l of raw.slice(0, 100)) {
    const o = (l ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? "").slice(0, 200);
    if (!name) continue;
    out.push({
      catalog_item_id: (o.catalog_item_id as string | null) ?? null,
      variation_id: (o.variation_id as string | null) ?? null,
      name,
      unit_price: r2(Number(o.unit_price) || 0),
      quantity: Math.min(99, Math.max(1, Math.round(Number(o.quantity) || 1))),
      taxable: o.taxable !== false,
      note: o.note ? String(o.note).slice(0, 300) : null,
      allergy: o.allergy ? String(o.allergy).slice(0, 200) : null,
      course_id: (o.course_id as string | null) ?? null,
    });
  }
  return out;
}

export async function listSavedTickets(): Promise<SavedTicket[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_tickets")
    .select("id, name, scope, lines")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    name: (t.name as string) || "Ticket",
    scope: (t.scope as string) || "quick",
    lines: cleanLines(t.lines),
  }));
}

export async function saveSavedTicket(input: { name: string; scope: string; lines: SavedLine[] }): Promise<{ ok: true; id: string } | { error: string }> {
  const { business } = await requireBusiness();
  const name = (input.name || "").trim().slice(0, 60);
  if (!name) return { error: "Give the ticket a name." };
  const lines = cleanLines(input.lines);
  if (lines.length === 0) return { error: "Nothing to save." };
  const scope = input.scope === "favorite" ? "favorite" : "quick";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("saved_tickets")
    .insert({ business_id: business.id, name, scope, lines, created_by: user ? user.id : null })
    .select("id")
    .single();
  if (error || !data) {
    console.error("saveSavedTicket:", error);
    return { error: "Could not save the ticket." };
  }
  return { ok: true, id: data.id as string };
}

export async function deleteSavedTicket(id: string): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase.from("saved_tickets").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  return { ok: true };
}
