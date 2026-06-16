"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const rateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  rate: z.coerce.number().min(0).max(100),
});

type RateResult = { ok: true; id: string } | { error: string };

export async function createTaxRate(name: string, rate: number): Promise<RateResult> {
  const parsed = rateSchema.safeParse({ name: name, rate: rate });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can manage tax rates." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .insert({
      business_id: business.id,
      name: parsed.data.name,
      rate: parsed.data.rate,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createTaxRate:", error);
    return { error: "Could not add the tax rate. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/catalog");
  return { ok: true, id: data.id as string };
}

export async function deleteTaxRate(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing tax rate." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can manage tax rates." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_rates")
    .update({ is_active: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteTaxRate:", error);
    return { error: "Could not remove the tax rate. Please try again." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/catalog");
  return { ok: true };
}