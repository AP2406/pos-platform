"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { cleanAllergens } from "@/lib/allergens";
import { integrationEnabled } from "@/lib/services/integrations";
import { notifyPlatforms86 } from "@/lib/services/delivery";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeAction } from "@/lib/services/action-guard";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  price: z.coerce.number().min(0).max(1000000),
  category: z.string().max(60).optional().or(z.literal("")),
  taxable: z.boolean().optional(),
  barcode: z.string().max(120).optional().or(z.literal("")),
  image_url: z.string().url().max(2000).optional().or(z.literal("")),
  // TouchBistro-parity per-item fields (all optional/additive).
  sales_category: z.string().max(60).optional().or(z.literal("")),
  short_name: z.string().max(60).optional().or(z.literal("")),
  open_price: z.boolean().optional(),
  requires_manager_approval: z.boolean().optional(),
  allow_returns: z.boolean().optional(),
  print_separate_ticket: z.boolean().optional(),
});

type ItemInput = {
  name: string;
  price: number;
  category?: string;
  taxable?: boolean;
  barcode?: string;
  image_url?: string;
  sales_category?: string;
  short_name?: string;
  open_price?: boolean;
  requires_manager_approval?: boolean;
  allow_returns?: boolean;
  print_separate_ticket?: boolean;
};

// The additive per-item columns, normalized. Only fields actually PRESENT in the
// input are patched, so an update that doesn't send them (e.g. an inline name/
// price edit) never wipes them to defaults.
function itemExtraFields(d: {
  sales_category?: string;
  short_name?: string;
  open_price?: boolean;
  requires_manager_approval?: boolean;
  allow_returns?: boolean;
  print_separate_ticket?: boolean;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.sales_category !== undefined) out.sales_category = d.sales_category ? d.sales_category.trim().slice(0, 60) : null;
  if (d.short_name !== undefined) out.short_name = d.short_name ? d.short_name.trim().slice(0, 60) : null;
  if (d.open_price !== undefined) out.open_price = !!d.open_price;
  if (d.requires_manager_approval !== undefined) out.requires_manager_approval = !!d.requires_manager_approval;
  if (d.allow_returns !== undefined) out.allow_returns = !!d.allow_returns;
  if (d.print_separate_ticket !== undefined) out.print_separate_ticket = !!d.print_separate_ticket;
  return out;
}

function cleanBarcode(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return t.length > 0 ? t.slice(0, 120) : null;
}

export async function createCatalogItem(
  input: ItemInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  const code = cleanBarcode(parsed.data.barcode);
  if (code) {
    const { data: dups } = await supabase
      .from("catalog_items")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("barcode", code)
      .limit(1);
    if (dups && dups.length > 0) {
      return { error: "That code is already used by " + (dups[0].name as string) + "." };
    }
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      price: parsed.data.price,
      category: parsed.data.category || null,
      taxable: parsed.data.taxable === false ? false : true,
      barcode: code,
      image_url: parsed.data.image_url || null,
      ...itemExtraFields(parsed.data),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createCatalogItem:", error);
    return { error: "Could not add item. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true, id: data.id };
}

export async function updateCatalogItem(
  id: string,
  input: ItemInput
): Promise<{ ok: true } | { error: string }> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    name: parsed.data.name,
    price: parsed.data.price,
    category: parsed.data.category || null,
  };
  if (typeof parsed.data.taxable === "boolean") {
    updateData.taxable = parsed.data.taxable;
  }
  if (typeof parsed.data.barcode === "string") {
    updateData.barcode = cleanBarcode(parsed.data.barcode);
  }
  if (typeof parsed.data.image_url === "string") {
    updateData.image_url = parsed.data.image_url || null;
  }
  Object.assign(updateData, itemExtraFields(parsed.data));

  const { error } = await supabase
    .from("catalog_items")
    .update(updateData)
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateCatalogItem:", error);
    return { error: "Could not update item. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemOutOfStock(
  id: string,
  outOfStock: boolean,
  reason?: string
): Promise<{ ok: true; at: string | null } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const at = outOfStock ? new Date().toISOString() : null;
  const note =
    outOfStock && reason && reason.trim() ? reason.trim().slice(0, 120) : null;
  const { error } = await supabase
    .from("catalog_items")
    .update({ out_of_stock: outOfStock, out_of_stock_at: at, out_of_stock_note: note })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemOutOfStock:", error);
    return { error: "Could not update the item." };
  }
  revalidatePath("/app/catalog");
  revalidatePath("/app/pos");

  // GAP-1: mirror the 86 to any connected delivery platforms. No-op until a
  // platform is configured; never blocks the toggle.
  if (integrationEnabled((business as { settings?: unknown }).settings, "delivery")) {
    try {
      const { data: item } = await supabase.from("catalog_items").select("name").eq("id", id).eq("business_id", business.id).maybeSingle();
      await notifyPlatforms86(business.id, (item?.name as string) || "Item", outOfStock);
    } catch (e) {
      console.error("notifyPlatforms86:", e);
    }
  }
  return { ok: true, at };
}

export async function setCatalogItemPrepMinutes(
  id: string,
  prepMinutes: number | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  let v: number | null = null;
  if (prepMinutes != null && Number.isFinite(prepMinutes)) {
    v = Math.max(0, Math.min(240, Math.round(prepMinutes)));
    if (v === 0) v = null;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ prep_minutes: v })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemPrepMinutes:", error);
    return { error: "Could not update prep time. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemAllergens(
  id: string,
  allergens: string[]
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const clean = cleanAllergens(allergens);
  const { error } = await supabase
    .from("catalog_items")
    .update({ allergens: clean })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemAllergens:", error);
    return { error: "Could not update allergens. Please try again." };
  }
  revalidatePath("/app/catalog");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function setCatalogItemActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { error: string }> {
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ is_active: active })
    .eq("id", id);
  if (error) {
    console.error("setCatalogItemActive:", error);
    return { error: "Could not update item." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemTaxable(
  id: string,
  taxable: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({ taxable: taxable })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemTaxable:", error);
    return { error: "Could not update item." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemBarcode(
  id: string,
  barcode: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  const code = cleanBarcode(barcode);
  if (code) {
    const { data: dups } = await supabase
      .from("catalog_items")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("barcode", code)
      .neq("id", id)
      .limit(1);
    if (dups && dups.length > 0) {
      return { error: "That code is already used by " + (dups[0].name as string) + "." };
    }
  }

  const { error } = await supabase
    .from("catalog_items")
    .update({ barcode: code })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemBarcode:", error);
    return { error: "Could not update the code. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemImage(
  id: string,
  imageUrl: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  let url: string | null = null;
  if (imageUrl) {
    const t = imageUrl.trim();
    url = t.length > 0 ? t.slice(0, 2000) : null;
  }

  const { error } = await supabase
    .from("catalog_items")
    .update({ image_url: url })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemImage:", error);
    return { error: "Could not update the photo. Please try again." };
  }
  revalidatePath("/app/catalog");
  revalidatePath("/app/pos");
  return { ok: true };
}

export async function saveCategoryColors(
  map: Record<string, string>
): Promise<{ ok: true } | { error: string }> {
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business, role } = auth;
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change category colors." };
  }
  const supabase = await createClient();

  // Keep only string->string entries, trimmed, and bounded so a bad client
  // payload can't bloat the row.
  const clean: Record<string, string> = {};
  for (const key of Object.keys(map || {})) {
    const name = (key || "").trim().slice(0, 60);
    const value = (map[key] || "").trim().slice(0, 40);
    if (name && value) clean[name] = value;
  }

  const { error } = await supabase
    .from("businesses")
    .update({ category_colors: clean })
    .eq("id", business.id);
  if (error) {
    console.error("saveCategoryColors:", error);
    return { error: "Could not save category colors. Please try again." };
  }
  revalidatePath("/app/catalog");
  revalidatePath("/app/pos");
  return { ok: true };
}

const variationSchema = z.object({
  catalog_item_id: z.string().uuid(),
  name: z.string().min(1, "Variation name is required").max(80),
  price: z.coerce.number().min(0).max(1000000),
});

export async function createVariation(
  catalogItemId: string,
  name: string,
  price: number
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = variationSchema.safeParse({
    catalog_item_id: catalogItemId,
    name: name,
    price: price,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", parsed.data.catalog_item_id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { data, error } = await supabase
    .from("catalog_item_variations")
    .insert({
      business_id: business.id,
      catalog_item_id: parsed.data.catalog_item_id,
      name: parsed.data.name,
      price: parsed.data.price,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createVariation:", error);
    return { error: "Could not add variation. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true, id: data.id as string };
}

export async function deleteVariation(
  variationId: string
): Promise<{ ok: true } | { error: string }> {
  if (!variationId) return { error: "Missing variation." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_item_variations")
    .delete()
    .eq("id", variationId)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteVariation:", error);
    return { error: "Could not remove variation. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

const modifierSchema = z.object({
  catalog_item_id: z.string().uuid(),
  name: z.string().min(1, "Add-on name is required").max(80),
  price: z.coerce.number().min(0).max(1000000),
});

export async function createModifier(
  catalogItemId: string,
  name: string,
  price: number,
  groupId?: string | null
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = modifierSchema.safeParse({
    catalog_item_id: catalogItemId,
    name: name,
    price: price,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", parsed.data.catalog_item_id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  // Validate the group belongs to this item, when one is given.
  if (groupId) {
    const { data: grp } = await supabase
      .from("catalog_modifier_groups")
      .select("id")
      .eq("id", groupId)
      .eq("catalog_item_id", parsed.data.catalog_item_id)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!grp) return { error: "Group not found." };
  }

  const { data, error } = await supabase
    .from("catalog_item_modifiers")
    .insert({
      business_id: business.id,
      catalog_item_id: parsed.data.catalog_item_id,
      name: parsed.data.name,
      price: parsed.data.price,
      group_id: groupId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createModifier:", error);
    return { error: "Could not add the add-on. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true, id: data.id as string };
}

// P0-3: link a modifier option to a follow-up (child) group, or clear it.
export async function setModifierChildGroup(
  modifierId: string,
  childGroupId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!modifierId) return { error: "Missing option." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  if (childGroupId) {
    const { data: grp } = await supabase
      .from("catalog_modifier_groups")
      .select("id")
      .eq("id", childGroupId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!grp) return { error: "Group not found." };
  }
  const { error } = await supabase
    .from("catalog_item_modifiers")
    .update({ child_group_id: childGroupId })
    .eq("id", modifierId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setModifierChildGroup:", error);
    return { error: "Could not link the follow-up group." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

// --- P0-2: modifier groups (required / min / max selection rules) ---
const groupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(60),
  required: z.coerce.boolean().optional(),
  min_select: z.coerce.number().int().min(0).max(50).optional(),
  max_select: z.coerce.number().int().min(1).max(50).optional().nullable(),
  // Half/left-right (pizza-style) — each chosen option can be placed Whole/Left/Right.
  allow_split: z.coerce.boolean().optional(),
});

export async function createModifierGroup(
  catalogItemId: string,
  input: { name: string; required?: boolean; min_select?: number; max_select?: number | null; allow_split?: boolean }
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", catalogItemId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };
  const { data: maxRow } = await supabase
    .from("catalog_modifier_groups")
    .select("sort_order")
    .eq("catalog_item_id", catalogItemId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort = maxRow ? (maxRow.sort_order as number) + 1 : 0;
  const required = parsed.data.required ?? false;
  let min = parsed.data.min_select ?? (required ? 1 : 0);
  let max = parsed.data.max_select ?? null;
  if (required && min < 1) min = 1;
  if (max !== null && max < min) max = min;
  const { data, error } = await supabase
    .from("catalog_modifier_groups")
    .insert({
      business_id: business.id,
      catalog_item_id: catalogItemId,
      name: parsed.data.name,
      required: required,
      min_select: min,
      max_select: max,
      allow_split: parsed.data.allow_split ?? false,
      sort_order: sort,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createModifierGroup:", error);
    return { error: "Could not add the group. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true, id: data.id as string };
}

export async function updateModifierGroup(
  id: string,
  input: { name?: string; required?: boolean; min_select?: number; max_select?: number | null; allow_split?: boolean }
): Promise<{ ok: true; required: boolean; min_select: number; max_select: number | null } | { error: string }> {
  if (!id) return { error: "Missing group." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  // Read the current group so min/max/required stay mutually coherent even when only
  // one field is edited (each field saves on its own blur). An incoherent range the
  // register can never satisfy — max < min, or required with min 0 — would silently
  // break enforcement (the whole point of a forced modifier).
  const { data: cur } = await supabase
    .from("catalog_modifier_groups")
    .select("required, min_select, max_select")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!cur) return { error: "Group not found." };

  const required = input.required !== undefined ? !!input.required : !!cur.required;
  let min = input.min_select !== undefined ? Math.max(0, Math.min(50, Math.round(input.min_select))) : Number(cur.min_select) || 0;
  let max =
    input.max_select !== undefined
      ? input.max_select === null
        ? null
        : Math.max(1, Math.min(50, Math.round(input.max_select)))
      : cur.max_select == null
        ? null
        : Number(cur.max_select);
  if (required && min < 1) min = 1; // a required group must let the guest pick at least one
  if (max !== null && max < min) max = min; // max can never be below min

  const patch: Record<string, unknown> = { required, min_select: min, max_select: max };
  if (input.name !== undefined) patch.name = input.name.trim().slice(0, 60) || "Group";
  if (input.allow_split !== undefined) patch.allow_split = !!input.allow_split;
  const { error } = await supabase
    .from("catalog_modifier_groups")
    .update(patch)
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateModifierGroup:", error);
    return { error: "Could not update the group." };
  }
  revalidatePath("/app/catalog");
  return { ok: true, required, min_select: min, max_select: max };
}

export async function deleteModifierGroup(
  id: string
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing group." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  // Options cascade-delete via the FK.
  const { error } = await supabase
    .from("catalog_modifier_groups")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteModifierGroup:", error);
    return { error: "Could not remove the group." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function deleteModifier(
  modifierId: string
): Promise<{ ok: true } | { error: string }> {
  if (!modifierId) return { error: "Missing add-on." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_item_modifiers")
    .delete()
    .eq("id", modifierId)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteModifier:", error);
    return { error: "Could not remove the add-on. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

export async function setCatalogItemTaxRate(
  id: string,
  taxRateId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  if (taxRateId) {
    const { data: rate } = await supabase
      .from("tax_rates")
      .select("id")
      .eq("id", taxRateId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!rate) return { error: "Tax rate not found." };
  }

  const { error } = await supabase
    .from("catalog_items")
    .update({ tax_rate_id: taxRateId })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemTaxRate:", error);
    return { error: "Could not update the tax rate. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}

// Multi-tax: set the full set of taxes on an item (junction is the source of truth).
// Also clears the legacy single tax_rate_id so an empty set unambiguously means "use
// the business default rate" (no stale fallback). Owner/manager only (RLS enforces).
export async function setCatalogItemTaxes(
  id: string,
  rateIds: string[]
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business, role } = auth;
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can change taxes." };
  const supabase = await createClient();

  const wanted = Array.from(new Set((rateIds || []).filter((x) => !!x)));
  if (wanted.length > 0) {
    const { data: valid } = await supabase
      .from("tax_rates")
      .select("id")
      .eq("business_id", business.id)
      .in("id", wanted);
    const validIds = new Set((valid ?? []).map((r) => r.id as string));
    if (wanted.some((x) => !validIds.has(x))) return { error: "One of those tax rates was not found." };
  }

  // Replace the junction rows for this item.
  const { error: delErr } = await supabase
    .from("catalog_item_taxes")
    .delete()
    .eq("business_id", business.id)
    .eq("catalog_item_id", id);
  if (delErr) { console.error("setCatalogItemTaxes delete:", delErr); return { error: "Could not update taxes. Please try again." }; }

  if (wanted.length > 0) {
    const rows = wanted.map((rid) => ({ business_id: business.id, catalog_item_id: id, tax_rate_id: rid }));
    const { error: insErr } = await supabase.from("catalog_item_taxes").insert(rows);
    if (insErr) { console.error("setCatalogItemTaxes insert:", insErr); return { error: "Could not update taxes. Please try again." }; }
  }

  // Clear the legacy single rate so the junction is authoritative (empty = default).
  await supabase.from("catalog_items").update({ tax_rate_id: null }).eq("id", id).eq("business_id", business.id);

  revalidatePath("/app/catalog");
  revalidatePath("/app/pos");
  return { ok: true };
}

// P0-1: the course a menu item fires with by default on a full-service table.
export async function setCatalogItemDefaultCourse(
  id: string,
  courseId: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing item." };
  const auth = await authorizeAction("edit_menu", { configWrite: true });
  if (!auth.ok) return { error: auth.error };
  const { business } = auth;
  const supabase = await createClient();

  if (courseId) {
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!course) return { error: "Course not found." };
  }

  const { error } = await supabase
    .from("catalog_items")
    .update({ default_course_id: courseId })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("setCatalogItemDefaultCourse:", error);
    return { error: "Could not update the course. Please try again." };
  }
  revalidatePath("/app/catalog");
  return { ok: true };
}