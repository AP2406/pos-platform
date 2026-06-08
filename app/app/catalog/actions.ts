"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  price: z.coerce.number().min(0).max(1000000),
  category: z.string().max(60).optional().or(z.literal("")),
  taxable: z.boolean().optional(),
  barcode: z.string().max(120).optional().or(z.literal("")),
});

type ItemInput = {
  name: string;
  price: number;
  category?: string;
  taxable?: boolean;
  barcode?: string;
};

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
  const { business } = await requireBusiness();
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
  const { business } = await requireBusiness();
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

export async function setCatalogItemActive(
  id: string,
  active: boolean
): Promise<{ ok: true } | { error: string }> {
  await requireBusiness();
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
  const { business } = await requireBusiness();
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
  const { business } = await requireBusiness();
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
  const { business } = await requireBusiness();
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
  const { business } = await requireBusiness();
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
  price: number
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = modifierSchema.safeParse({
    catalog_item_id: catalogItemId,
    name: name,
    price: price,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", parsed.data.catalog_item_id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { data, error } = await supabase
    .from("catalog_item_modifiers")
    .insert({
      business_id: business.id,
      catalog_item_id: parsed.data.catalog_item_id,
      name: parsed.data.name,
      price: parsed.data.price,
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

export async function deleteModifier(
  modifierId: string
): Promise<{ ok: true } | { error: string }> {
  if (!modifierId) return { error: "Missing add-on." };
  const { business } = await requireBusiness();
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
  const { business } = await requireBusiness();
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