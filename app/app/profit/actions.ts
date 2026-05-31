"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function createExpense(input: {
  amount: number;
  category: string;
  subcategory?: string;
  description?: string;
  incurred_on: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const amount = Number(input.amount);
  if (!input.category || !input.category.trim()) {
    return { ok: false, error: "Category is required." };
  }
  if (isNaN(amount) || amount < 0) {
    return { ok: false, error: "Enter a valid amount." };
  }

  const { error } = await supabase.from("expenses").insert({
    business_id: business.id,
    amount,
    category: input.category.trim(),
    subcategory: input.subcategory?.trim() || null,
    description: input.description?.trim() || null,
    incurred_on: input.incurred_on || new Date().toISOString().slice(0, 10),
    source: "manual",
  });

  if (error) {
    console.error("createExpense:", error);
    return { ok: false, error: "Couldn't save the expense." };
  }
  revalidatePath("/app/profit");
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/app/profit");
  return { ok: true };
}