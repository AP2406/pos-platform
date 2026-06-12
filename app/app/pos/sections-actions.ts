"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export type Section = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  server: { id: string; name: string } | null;
  element_ids: string[];
};
export type AssignableTable = { id: string; label: string; section_id: string | null };

const DEFAULT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"];

async function requireManager() {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner" && ctx.role !== "manager") return { error: "Only an owner or manager can change sections." as const };
  return ctx;
}

// Sections with each one's current-shift server + the tables that belong to it.
export async function listSections(): Promise<Section[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("floor_sections")
    .select("id, name, color, sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true });
  const sections = rows ?? [];
  const ids = sections.map((s) => s.id as string);

  const memberBySection: Record<string, string[]> = {};
  const { data: els } = await supabase
    .from("floor_elements")
    .select("id, section_id")
    .eq("business_id", business.id)
    .not("section_id", "is", null);
  for (const e of els ?? []) {
    const sid = e.section_id as string;
    if (!memberBySection[sid]) memberBySection[sid] = [];
    memberBySection[sid].push(e.id as string);
  }

  const serverBySection: Record<string, { id: string; name: string }> = {};
  if (ids.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: assigns } = await supabase
      .from("section_assignments")
      .select("section_id, staff_id, staff:staff_members(name)")
      .eq("business_id", business.id)
      .eq("shift_date", today)
      .in("section_id", ids);
    for (const a of assigns ?? []) {
      const staff = Array.isArray(a.staff) ? a.staff[0] : a.staff;
      serverBySection[a.section_id as string] = { id: a.staff_id as string, name: (staff?.name as string) || "Server" };
    }
  }

  return sections.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    color: (s.color as string | null) ?? null,
    sort_order: s.sort_order as number,
    server: serverBySection[s.id as string] ?? null,
    element_ids: memberBySection[s.id as string] ?? [],
  }));
}

export async function listAssignableTables(): Promise<AssignableTable[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("floor_elements")
    .select("id, label, section_id, sort_order")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .in("kind", ["table", "booth"])
    .order("sort_order", { ascending: true });
  return (data ?? []).map((e) => ({ id: e.id as string, label: (e.label as string) || "Table", section_id: (e.section_id as string | null) ?? null }));
}

export async function createSection(name: string): Promise<{ ok: true; section: Section } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a section name." };
  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("floor_sections").select("sort_order").eq("business_id", ctx.business.id)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sort = maxRow ? (maxRow.sort_order as number) + 1 : 0;
  const color = DEFAULT_COLORS[sort % DEFAULT_COLORS.length];
  const { data, error } = await supabase
    .from("floor_sections")
    .insert({ business_id: ctx.business.id, name: clean, color: color, sort_order: sort })
    .select("id, name, color, sort_order").single();
  if (error || !data) return { error: "Could not add the section." };
  revalidatePath("/app/settings");
  return { ok: true, section: { id: data.id as string, name: data.name as string, color: data.color as string, sort_order: data.sort_order as number, server: null, element_ids: [] } };
}

export async function renameSection(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Enter a section name." };
  const supabase = await createClient();
  const { error } = await supabase.from("floor_sections").update({ name: clean }).eq("id", id).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not rename the section." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setSectionColor(id: string, color: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const clean = /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
  const supabase = await createClient();
  const { error } = await supabase.from("floor_sections").update({ color: clean }).eq("id", id).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not set the color." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function deleteSection(id: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  const { error } = await supabase.from("floor_sections").delete().eq("id", id).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not remove the section." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setElementSection(elementId: string, sectionId: string | null): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  if (sectionId) {
    const { data: sec } = await supabase.from("floor_sections").select("id").eq("id", sectionId).eq("business_id", ctx.business.id).maybeSingle();
    if (!sec) return { error: "Section not found." };
  }
  const { error } = await supabase.from("floor_elements").update({ section_id: sectionId }).eq("id", elementId).eq("business_id", ctx.business.id);
  if (error) return { error: "Could not assign the table." };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function assignSectionServer(sectionId: string, staffId: string | null): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireManager();
  if ("error" in ctx) return ctx;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  if (!staffId) {
    await supabase.from("section_assignments").delete().eq("business_id", ctx.business.id).eq("section_id", sectionId).eq("shift_date", today);
    revalidatePath("/app/settings");
    return { ok: true };
  }
  const { error } = await supabase
    .from("section_assignments")
    .upsert({ business_id: ctx.business.id, section_id: sectionId, staff_id: staffId, shift_date: today }, { onConflict: "section_id,shift_date" });
  if (error) { console.error("assignSectionServer:", error); return { error: "Could not assign the server." }; }
  revalidatePath("/app/settings");
  return { ok: true };
}
