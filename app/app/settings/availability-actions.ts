"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Menu dayparting: availability windows restrict an item or a whole category to
// recurring local-time windows on chosen days (e.g. breakfast 6:00–11:00). No
// window = always available (today's behavior). Customer menus honor these via
// catalog_available_now(); the register shows an off-hours badge (never blocks).

export type AvailabilityWindow = {
  id: string;
  name: string;
  scope: "item" | "category";
  target_item_id: string | null;
  target_category: string | null;
  days: number[];
  start_min: number;
  end_min: number;
  active: boolean;
};

const windowSchema = z.object({
  name: z.string().trim().min(1).max(60),
  scope: z.enum(["item", "category"]),
  target_item_id: z.string().uuid().nullable().optional(),
  target_category: z.string().trim().max(60).nullable().optional(),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  start_min: z.number().int().min(0).max(1440),
  end_min: z.number().int().min(0).max(1440),
});

export async function listAvailabilityWindows(): Promise<AvailabilityWindow[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("availability_windows")
    .select("id, name, scope, target_item_id, target_category, days, start_min, end_min, active")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });
  return (data ?? []).map((w) => ({
    id: w.id as string,
    name: w.name as string,
    scope: (w.scope as "item" | "category") ?? "item",
    target_item_id: (w.target_item_id as string | null) ?? null,
    target_category: (w.target_category as string | null) ?? null,
    days: Array.isArray(w.days) ? (w.days as number[]) : [],
    start_min: Number(w.start_min) || 0,
    end_min: Number(w.end_min) ?? 1440,
    active: w.active !== false,
  }));
}

export async function createAvailabilityWindow(input: {
  name: string;
  scope: "item" | "category";
  target_item_id?: string | null;
  target_category?: string | null;
  days: number[];
  start_min: number;
  end_min: number;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = windowSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the window details and try again." };
  const p = parsed.data;
  if (p.scope === "item" && !p.target_item_id) return { error: "Pick an item for an item window." };
  if (p.scope === "category" && !p.target_category) return { error: "Pick a category for a category window." };

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can set menu hours." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("availability_windows")
    .insert({
      business_id: business.id,
      name: p.name,
      scope: p.scope,
      target_item_id: p.scope === "item" ? p.target_item_id : null,
      target_category: p.scope === "category" ? p.target_category : null,
      days: p.days,
      start_min: p.start_min,
      end_min: p.end_min,
      active: true,
    })
    .select("id")
    .single();
  if (error || !data) { console.error("createAvailabilityWindow:", error); return { error: "Could not save the window." }; }
  revalidatePath("/app/settings");
  return { ok: true, id: data.id as string };
}

export async function deleteAvailabilityWindow(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing window." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change menu hours." };
  const supabase = await createClient();
  const { error } = await supabase.from("availability_windows").delete().eq("id", id).eq("business_id", business.id);
  if (error) { console.error("deleteAvailabilityWindow:", error); return { error: "Could not remove the window." }; }
  revalidatePath("/app/settings");
  return { ok: true };
}
