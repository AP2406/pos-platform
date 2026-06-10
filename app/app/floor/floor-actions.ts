"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type FloorArea = { id: string; name: string; sort_order: number };
export type FloorTable = {
  id: string;
  area_id: string | null;
  label: string;
  seats: number;
  sort_order: number;
  is_active: boolean;
};

type FloorGate =
  | { ok: false; error: string }
  | { ok: true; business: { id: string } };

// Only an owner or manager may shape the floor (mirrors the staff/settings gate).
async function requireFloorManager(): Promise<FloorGate> {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { ok: false, error: "Only an owner or manager can edit the floor." };
  }
  return { ok: true, business: { id: ctx.business.id } };
}

export async function listFloor(): Promise<{ areas: FloorArea[]; tables: FloorTable[] }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: areas } = await supabase
    .from("floor_areas")
    .select("id, name, sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: tables } = await supabase
    .from("floor_tables")
    .select("id, area_id, label, seats, sort_order, is_active")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    areas: (areas ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      sort_order: Number(a.sort_order) || 0,
    })),
    tables: (tables ?? []).map((t) => ({
      id: t.id as string,
      area_id: (t.area_id as string | null) ?? null,
      label: t.label as string,
      seats: Number(t.seats) || 0,
      sort_order: Number(t.sort_order) || 0,
      is_active: (t.is_active as boolean | null) ?? true,
    })),
  };
}

const nameSchema = z.string().trim().min(1, "Name is required.").max(60);

export async function createFloorArea(
  name: string
): Promise<{ ok: true; area: FloorArea } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("floor_areas")
    .select("id", { count: "exact", head: true })
    .eq("business_id", gate.business.id);

  const { data, error } = await supabase
    .from("floor_areas")
    .insert({ business_id: gate.business.id, name: parsed.data, sort_order: count ?? 0 })
    .select("id, name, sort_order")
    .single();
  if (error || !data) {
    console.error("createFloorArea:", error);
    return { error: "Could not add the area. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return {
    ok: true,
    area: { id: data.id as string, name: data.name as string, sort_order: Number(data.sort_order) || 0 },
  };
}

export async function renameFloorArea(
  id: string,
  name: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing area." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("floor_areas")
    .update({ name: parsed.data })
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("renameFloorArea:", error);
    return { error: "Could not rename the area." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function deleteFloorArea(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing area." };
  const supabase = await createClient();

  // Tables in this area keep existing; their area_id is set null by the FK
  // (on delete set null), so no tables are lost.
  const { error } = await supabase
    .from("floor_areas")
    .delete()
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("deleteFloorArea:", error);
    return { error: "Could not delete the area." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

const idListSchema = z.array(z.string().uuid()).max(200);

export async function reorderFloorAreas(
  orderedIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  const parsed = idListSchema.safeParse(orderedIds);
  if (!parsed.success) return { error: "Invalid order." };
  const supabase = await createClient();

  for (let i = 0; i < parsed.data.length; i++) {
    await supabase
      .from("floor_areas")
      .update({ sort_order: i })
      .eq("id", parsed.data[i])
      .eq("business_id", gate.business.id);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

const tableSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(40),
  seats: z.coerce.number().int().min(1).max(99),
  area_id: z.string().uuid().nullable().optional(),
});

export async function createFloorTable(input: {
  label: string;
  seats: number;
  area_id?: string | null;
}): Promise<{ ok: true; table: FloorTable } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid table." };
  const supabase = await createClient();

  const { count } = await supabase
    .from("floor_tables")
    .select("id", { count: "exact", head: true })
    .eq("business_id", gate.business.id);

  const { data, error } = await supabase
    .from("floor_tables")
    .insert({
      business_id: gate.business.id,
      label: parsed.data.label,
      seats: parsed.data.seats,
      area_id: parsed.data.area_id ?? null,
      sort_order: count ?? 0,
    })
    .select("id, area_id, label, seats, sort_order, is_active")
    .single();
  if (error || !data) {
    console.error("createFloorTable:", error);
    return { error: "Could not add the table. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return {
    ok: true,
    table: {
      id: data.id as string,
      area_id: (data.area_id as string | null) ?? null,
      label: data.label as string,
      seats: Number(data.seats) || 0,
      sort_order: Number(data.sort_order) || 0,
      is_active: (data.is_active as boolean | null) ?? true,
    },
  };
}

export async function updateFloorTable(
  id: string,
  input: { label: string; seats: number; area_id?: string | null }
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing table." };
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid table." };
  const supabase = await createClient();

  const { error } = await supabase
    .from("floor_tables")
    .update({
      label: parsed.data.label,
      seats: parsed.data.seats,
      area_id: parsed.data.area_id ?? null,
    })
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("updateFloorTable:", error);
    return { error: "Could not update the table." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function setFloorTableActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  if (!id) return { error: "Missing table." };
  const supabase = await createClient();

  // Deactivate, never hard-delete, so historical kitchen tickets keep their
  // table reference.
  const { error } = await supabase
    .from("floor_tables")
    .update({ is_active: active })
    .eq("id", id)
    .eq("business_id", gate.business.id);
  if (error) {
    console.error("setFloorTableActive:", error);
    return { error: "Could not update the table." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function reorderFloorTables(
  orderedIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };
  const parsed = idListSchema.safeParse(orderedIds);
  if (!parsed.success) return { error: "Invalid order." };
  const supabase = await createClient();

  for (let i = 0; i < parsed.data.length; i++) {
    await supabase
      .from("floor_tables")
      .update({ sort_order: i })
      .eq("id", parsed.data[i])
      .eq("business_id", gate.business.id);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}
