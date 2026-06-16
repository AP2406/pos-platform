"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

export async function updateBusinessSettings(input: {
  name: string;
  timezone: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);

  if (role !== "owner") {
    return { error: "Only owners can change settings." };
  }
  if (!input.name || input.name.trim().length < 2) {
    return { error: "Business name must be at least 2 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ name: input.name.trim(), timezone: input.timezone })
    .eq("id", business.id);

  if (error) {
    console.error("updateBusinessSettings:", error);
    return { error: "Could not save settings. Please try again." };
  }

  revalidatePath("/app");
  revalidatePath("/app/settings");
  return { ok: true };
}

const CURRENCIES = ["CAD", "USD"];

export async function updateTaxAndCurrency(input: {
  tax_percent: number;
  currency: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);

  if (role !== "owner") {
    return { error: "Only owners can change settings." };
  }

  let pct = Number(input.tax_percent);
  if (isNaN(pct) || pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  const taxDecimal = Math.round((pct / 100) * 10000) / 10000;

  const currency = CURRENCIES.includes(input.currency) ? input.currency : "CAD";

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ default_tax_rate: taxDecimal, currency: currency })
    .eq("id", business.id);

  if (error) {
    console.error("updateTaxAndCurrency:", error);
    return { error: "Could not save tax settings. Please try again." };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  revalidatePath("/app/pos/sales");
  return { ok: true };
}