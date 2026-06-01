"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  price: z.coerce.number().min(0).max(1000000),
  category: z.string().max(60).optional().or(z.literal("")),
});

type ItemInput = { name: string; price: number; category?: string };

export async function createCatalogItem(
  input: ItemInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      price: parsed.data.price,
      category: parsed.data.category || null,
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
  await requireBusiness();
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_items")
    .update({
      name: parsed.data.name,
      price: parsed.data.price,
      category: parsed.data.category || null,
    })
    .eq("id", id);
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