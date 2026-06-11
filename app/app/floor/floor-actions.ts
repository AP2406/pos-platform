"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
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
};

type FloorGate =
  | { ok: false; error: string }
  | { ok: true; business: { id: string } };

async function requireFloorManager(): Promise<FloorGate> {
  const ctx = await requireBusiness();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { ok: false, error: "Only an owner or manager can edit the floor." };
  }
  return { ok: true, business: { id: ctx.business.id } };
}

export async function listFloor(): Promise<{ elements: FloorElement[] }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data } = await supabase
    .from("floor_elements")
    .select("id, kind, label, x, y, w, h, rotation, shape, parent_id, seat_no, sort_order, is_active")
    .eq("business_id", business.id)
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

// Save the whole floor layout in one shot: upsert everything in the payload and
// remove anything no longer present — except elements that currently hold an
// open ticket (those are protected so a live table/seat can't be deleted from
// under a server).
export async function saveFloorLayout(
  elements: z.input<typeof elementSchema>[]
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireFloorManager();
  if (!gate.ok) return { error: gate.error };

  const parsed = z.array(elementSchema).max(500).safeParse(elements);
  if (!parsed.success) return { error: "The floor layout is invalid." };
  const items = parsed.data;

  // Auto-name unnamed tables "Table N", continuing past the highest existing N.
  let maxN = 0;
  for (const it of items) {
    if (it.kind === "table" && it.label) {
      const m = /^Table\s+(\d+)$/i.exec(it.label.trim());
      if (m) maxN = Math.max(maxN, parseInt(m[1]));
    }
  }
  let maxB = 0;
  for (const it of items) {
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

  // Reject duplicate active table names (case-insensitive).
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

  // Protect elements that currently hold an open ticket from deletion.
  const { data: openRows } = await supabase
    .from("open_tickets")
    .select("element_id")
    .eq("business_id", gate.business.id)
    .not("element_id", "is", null);
  const locked = new Set((openRows ?? []).map((r) => r.element_id as string));

  const { data: existingRows } = await supabase
    .from("floor_elements")
    .select("id")
    .eq("business_id", gate.business.id);
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
      // Surface the unique-table-name violation in a friendly way.
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
