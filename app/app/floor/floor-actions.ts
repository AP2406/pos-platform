"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, DEMO_LOCKED_MESSAGE } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ElementKind =
  | "table"
  | "booth"
  | "seat"
  | "counter"
  | "station"
  | "wall"
  | "room"
  | "label";

export type FloorElement = {
  id: string;
  kind: ElementKind;
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: "rect" | "round";
  parent_id: string | null;
  seat_no: number | null;
  sort_order: number;
  is_active: boolean;
  section_id: string | null;
};

export type FloorPlan = { id: string; name: string; sort_order: number };

type FloorGate =
  | { ok: false; error: string }
  | { ok: true; business: { id: string } };

async function requireFloorManager(): Promise<FloorGate> {
  const ctx = await requireBusiness();
  if (ctx.business.is_demo) {
    return { ok: false, error: DEMO_LOCKED_MESSAGE };
  }
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { ok: false, error: "Only an owner or manager can edit the floor." };
  }
  return { ok: true, business: { id: ctx.business.id } };
}

// All floor plans for the business. Creates a default "Main floor" if there
// are none so the editor and live floor always have a plan to show.
export async function listFloorPlans(): Promise<FloorPlan[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("floor_plans")
    .select("id, name, sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  let plans = data ?? [];
  if (plans.length === 0) {
    const { data: created } = await supabase
      .from("floor_plans")
      .insert({ business_id: business.id, name: "Main floor", sort_order: 0 })
      .select("id, name, sort_order")
      .single();
    if (created) plans = [created];
  }
  return plans.map((p) => ({
    id: p.id as string,
    name: p.name as string,
    sort_order: Number(p.sort_order) || 0,
  }));
}

const planNameSchema = z.string().trim().min(1, "Name is required.").max(60);

export async function createFloorPlan(
  name: string
): Promise<{ ok: true; plan: FloorPlan } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  const parsed = planNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("floor_plans")
    .select("id", { count: "exact", head: true })
    .eq("business_id", gate.business.id);

  const { data, error } = await supabase
    .from("floor_plans")
    .insert({ business_id: gate.business.id, name: parsed.data, sort_order: count ?? 0 })
    .select("id, name, sort_order")
    .single();
  if (error || !data) {
    console.error("createFloorPlan:", error);
    return { error: "Could not add the floor. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true, plan: { id: data.id as string, name: data.name as string, sort_order: Number(data.sort_order) || 0 } };
}

export async function renameFloorPlan(
  id: string,
  name: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing floor." };
  const parsed = planNameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("floor_plans")
    .update({ name: parsed.data })
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("renameFloorPlan:", error);
    return { error: "Could not rename the floor." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function deleteFloorPlan(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing floor." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("floor_plans")
    .select("id", { count: "exact", head: true })
    .eq("business_id", gate.business.id);
  if ((count ?? 0) <= 1) return { error: "Keep at least one floor." };

  // Elements on this plan cascade-delete via the FK.
  const { error } = await supabase
    .from("floor_plans")
    .delete()
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("deleteFloorPlan:", error);
    return { error: "Could not delete the floor." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

// Elements for one plan.
export async function listFloor(planId: string): Promise<{ elements: FloorElement[] }> {
  const { business } = await requireBusiness();
  if (!planId) return { elements: [] };
  const supabase = await createClient();

  const { data } = await supabase
    .from("floor_elements")
    .select("id, kind, label, x, y, w, h, rotation, shape, parent_id, seat_no, sort_order, is_active, section_id")
    .eq("business_id", business.id)
    .eq("plan_id", planId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    elements: (data ?? []).map((e) => ({
      id: e.id as string,
      kind: e.kind as ElementKind,
      label: (e.label as string | null) ?? null,
      x: Number(e.x) || 0,
      y: Number(e.y) || 0,
      w: Number(e.w) || 80,
      h: Number(e.h) || 80,
      rotation: Number(e.rotation) || 0,
      shape: (e.shape as "rect" | "round") ?? "rect",
      parent_id: (e.parent_id as string | null) ?? null,
      seat_no: (e.seat_no as number | null) ?? null,
      sort_order: Number(e.sort_order) || 0,
      is_active: (e.is_active as boolean | null) ?? true,
      section_id: (e.section_id as string | null) ?? null,
    })),
  };
}

const elementSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["table", "booth", "seat", "counter", "station", "wall", "room", "label"]),
  label: z.string().trim().max(60).nullable().optional(),
  x: z.coerce.number().int().min(-1000).max(20000),
  y: z.coerce.number().int().min(-1000).max(20000),
  w: z.coerce.number().int().min(8).max(20000),
  h: z.coerce.number().int().min(8).max(20000),
  rotation: z.coerce.number().int().min(0).max(359).optional(),
  shape: z.enum(["rect", "round"]).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  seat_no: z.coerce.number().int().min(0).max(999).nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(100000).optional(),
});

// Save one plan's layout: upsert its elements and remove anything no longer
// present ON THAT PLAN — except elements that currently hold an open ticket.
export async function saveFloorLayout(
  planId: string,
  elements: z.input<typeof elementSchema>[]
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!planId) return { error: "Missing floor." };

  const parsed = z.array(elementSchema).max(500).safeParse(elements);
  if (!parsed.success) return { error: "The floor layout is invalid." };
  const items = parsed.data;

  // Auto-name unnamed tables/booths within this plan.
  let maxN = 0;
  let maxB = 0;
  for (const it of items) {
    if (it.kind === "table" && it.label) {
      const m = /^Table\s+(\d+)$/i.exec(it.label.trim());
      if (m) maxN = Math.max(maxN, parseInt(m[1]));
    }
    if (it.kind === "booth" && it.label) {
      const m = /^Booth\s+(\d+)$/i.exec(it.label.trim());
      if (m) maxB = Math.max(maxB, parseInt(m[1]));
    }
  }
  const named = items.map((it) => {
    if (it.kind === "table" && (!it.label || !it.label.trim())) {
      maxN += 1;
      return { ...it, label: "Table " + maxN };
    }
    if (it.kind === "booth" && (!it.label || !it.label.trim())) {
      maxB += 1;
      return { ...it, label: "Booth " + maxB };
    }
    return it;
  });

  // Reject duplicate active table names within this plan.
  const seen = new Set<string>();
  for (const it of named) {
    if (it.kind !== "table" || !it.label) continue;
    const key = it.label.trim().toLowerCase();
    if (seen.has(key)) {
      return { error: 'Two tables are named "' + it.label.trim() + '". Table names must be unique.' };
    }
    seen.add(key);
  }

  const supabase = await createClient();

  const { data: openRows } = await supabase
    .from("open_tickets")
    .select("element_id")
    .eq("business_id", gate.business.id)
    .not("element_id", "is", null);
  const locked = new Set((openRows ?? []).map((r) => r.element_id as string));

  const { data: existingRows } = await supabase
    .from("floor_elements")
    .select("id")
    .eq("business_id", gate.business.id)
    .eq("plan_id", planId);
  const existing = new Set((existingRows ?? []).map((r) => r.id as string));
  const keepIds = new Set(named.map((it) => it.id));

  const toDelete = [...existing].filter((id) => !keepIds.has(id) && !locked.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("floor_elements")
      .delete()
      .eq("business_id", gate.business.id)
      .in("id", toDelete);
    if (delErr) {
      console.error("saveFloorLayout delete:", delErr);
      return { error: "Could not save the floor. Please try again." };
    }
  }

  const rows = named.map((it, i) => ({
    id: it.id,
    business_id: gate.business.id,
    plan_id: planId,
    kind: it.kind,
    label: it.label && it.label.trim() ? it.label.trim() : null,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    rotation: it.rotation ?? 0,
    shape: it.shape ?? "rect",
    parent_id: it.parent_id ?? null,
    seat_no: it.seat_no ?? null,
    sort_order: it.sort_order ?? i,
    is_active: true,
  }));

  if (rows.length > 0) {
    const { error: upErr } = await supabase
      .from("floor_elements")
      .upsert(rows, { onConflict: "id" });
    if (upErr) {
      console.error("saveFloorLayout upsert:", upErr);
      if ((upErr as { code?: string }).code === "23505") {
        return { error: "Table names must be unique." };
      }
      return { error: "Could not save the floor. Please try again." };
    }
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}
