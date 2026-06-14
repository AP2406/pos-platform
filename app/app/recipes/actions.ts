"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Recipe costing is back-office: owner/manager only (RLS still scopes to tenant).
function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

const UNITS = ["unit", "each", "g", "kg", "ml", "L", "oz", "lb", "tbsp", "tsp", "cup", "slice"];

function cleanUnit(u: string): string {
  const t = (u || "").trim();
  return UNITS.includes(t) ? t : t ? t.slice(0, 16) : "unit";
}

function cleanCost(v: unknown): number {
  // Per-unit cost in dollars; clamp to >= 0, 4 decimal places (sub-cent costs are real).
  return Math.max(0, Math.round((Number(v) || 0) * 10000) / 10000);
}

function cleanQty(v: unknown): number {
  return Math.max(0, Math.round((Number(v) || 0) * 10000) / 10000);
}

export async function createIngredient(
  name: string,
  unit: string,
  cost: number
): Promise<{ ok: true; id: string } | { error: string }> {
  const n = (name || "").trim();
  if (n.length < 1) return { error: "Enter an ingredient name." };

  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingredients")
    .insert({
      business_id: business.id,
      name: n.slice(0, 120),
      unit: cleanUnit(unit),
      cost: cleanCost(cost),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "An ingredient with that name already exists." };
    console.error("createIngredient:", error);
    return { error: "Could not add the ingredient. Please try again." };
  }
  revalidatePath("/app/recipes");
  return { ok: true, id: data.id as string };
}

export async function updateIngredient(
  id: string,
  fields: { name?: string; unit?: string; cost?: number; is_active?: boolean }
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing ingredient." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (n.length < 1) return { error: "Enter an ingredient name." };
    patch.name = n.slice(0, 120);
  }
  if (fields.unit !== undefined) patch.unit = cleanUnit(fields.unit);
  if (fields.cost !== undefined) patch.cost = cleanCost(fields.cost);
  if (fields.is_active !== undefined) patch.is_active = !!fields.is_active;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("ingredients")
    .update(patch)
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    if (error.code === "23505") return { error: "An ingredient with that name already exists." };
    console.error("updateIngredient:", error);
    return { error: "Could not save the ingredient. Please try again." };
  }
  revalidatePath("/app/recipes");
  return { ok: true };
}

export async function deleteIngredient(
  id: string
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing ingredient." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  // FK cascade removes any recipe lines that referenced this ingredient.
  const { error } = await supabase
    .from("ingredients")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    console.error("deleteIngredient:", error);
    return { error: "Could not remove the ingredient. Please try again." };
  }
  revalidatePath("/app/recipes");
  return { ok: true };
}

const STOCK_REASONS = ["receive", "adjustment", "damage", "initial", "recount"];

// Turn ingredient stock tracking on/off + set its low-stock threshold.
export async function setIngredientStock(
  id: string,
  track: boolean,
  reorderPoint: number
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing ingredient." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  const rp = Math.max(0, Math.round((Number(reorderPoint) || 0) * 10000) / 10000);
  const { error } = await supabase
    .from("ingredients")
    .update({ track_stock: !!track, reorder_point: rp })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) {
    console.error("setIngredientStock:", error);
    return { error: "Could not save stock settings. Please try again." };
  }
  revalidatePath("/app/recipes");
  return { ok: true };
}

// Receive / adjust / count an ingredient's on-hand quantity (atomic RPC + ledger).
export async function adjustIngredientStock(
  id: string,
  change: number,
  reason: string,
  note?: string
): Promise<{ ok: true; new_qty: number } | { error: string }> {
  if (!id) return { error: "Missing ingredient." };
  const chg = Math.round((Number(change) || 0) * 10000) / 10000;
  if (chg === 0) return { error: "Enter a non-zero amount." };
  const r = STOCK_REASONS.includes(reason) ? reason : "adjustment";

  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("apply_ingredient_change", {
    p_business_id: business.id,
    p_ingredient_id: id,
    p_change: chg,
    p_reason: r,
    p_note: note && note.trim() ? note.trim().slice(0, 300) : null,
    p_order_id: null,
  });

  if (error || data === null || data === undefined) {
    console.error("adjustIngredientStock:", error);
    return { error: "Could not adjust stock. Please try again." };
  }
  revalidatePath("/app/recipes");
  return { ok: true, new_qty: Number(data) };
}

// Replace a dish's entire recipe with the given lines (delete-missing + upsert).
export async function saveRecipe(
  catalogItemId: string,
  lines: { ingredient_id: string; quantity: number }[]
): Promise<{ ok: true } | { error: string }> {
  if (!catalogItemId) return { error: "Missing dish." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage recipes." };
  const supabase = await createClient();

  // Confirm the dish belongs to this business.
  const { data: dish } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", catalogItemId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!dish) return { error: "Dish not found." };

  // Normalize: drop blank/zero lines, dedupe by ingredient (last wins).
  const byIngredient = new Map<string, number>();
  for (const l of lines || []) {
    if (!l || !l.ingredient_id) continue;
    const q = cleanQty(l.quantity);
    if (q <= 0) continue;
    byIngredient.set(l.ingredient_id, q);
  }
  const keep = [...byIngredient.entries()].map(([ingredient_id, quantity]) => ({
    ingredient_id,
    quantity,
  }));

  // Validate the ingredient ids are this business's.
  if (keep.length > 0) {
    const { data: valid } = await supabase
      .from("ingredients")
      .select("id")
      .eq("business_id", business.id)
      .in("id", keep.map((k) => k.ingredient_id));
    const validIds = new Set((valid ?? []).map((v) => v.id as string));
    for (const k of keep) {
      if (!validIds.has(k.ingredient_id)) return { error: "Unknown ingredient in recipe." };
    }
  }

  // Delete lines no longer present, then upsert the rest.
  const keepIds = keep.map((k) => k.ingredient_id);
  let del = supabase
    .from("recipe_ingredients")
    .delete()
    .eq("business_id", business.id)
    .eq("catalog_item_id", catalogItemId);
  if (keepIds.length > 0) {
    del = del.not("ingredient_id", "in", `(${keepIds.join(",")})`);
  }
  const { error: delErr } = await del;
  if (delErr) {
    console.error("saveRecipe delete:", delErr);
    return { error: "Could not save the recipe. Please try again." };
  }

  if (keep.length > 0) {
    const rows = keep.map((k) => ({
      business_id: business.id,
      catalog_item_id: catalogItemId,
      ingredient_id: k.ingredient_id,
      quantity: k.quantity,
    }));
    const { error: upErr } = await supabase
      .from("recipe_ingredients")
      .upsert(rows, { onConflict: "catalog_item_id,ingredient_id" });
    if (upErr) {
      console.error("saveRecipe upsert:", upErr);
      return { error: "Could not save the recipe. Please try again." };
    }
  }

  revalidatePath("/app/recipes");
  return { ok: true };
}
