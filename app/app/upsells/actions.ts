"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// E6 suggestive-selling / combo prompts — owner/manager CRUD.
export type UpsellPrompt = {
  id: string;
  triggerScope: "item" | "category";
  triggerItemId: string | null;
  triggerCategory: string | null;
  suggestItemId: string;
  label: string | null;
  comboDiscount: number;
};

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

function rowTo(r: Record<string, unknown>): UpsellPrompt & { active: boolean } {
  return {
    id: r.id as string,
    triggerScope: (r.trigger_scope as string) === "category" ? "category" : "item",
    triggerItemId: (r.trigger_item_id as string | null) ?? null,
    triggerCategory: (r.trigger_category as string | null) ?? null,
    suggestItemId: r.suggest_item_id as string,
    label: (r.label as string | null) ?? null,
    comboDiscount: Number(r.combo_discount) || 0,
    active: r.active !== false,
  };
}

export async function listUpsellPrompts(activeOnly = false): Promise<(UpsellPrompt & { active: boolean })[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  let q = supabase.from("upsell_prompts").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []).map(rowTo);
}

export async function addUpsellPrompt(input: {
  triggerScope: "item" | "category";
  triggerItemId?: string | null;
  triggerCategory?: string | null;
  suggestItemId: string;
  label?: string | null;
  comboDiscount?: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can set this." };
  const scope = input.triggerScope === "category" ? "category" : "item";
  if (scope === "item" && !input.triggerItemId) return { error: "Pick the trigger item." };
  if (scope === "category" && !input.triggerCategory) return { error: "Pick the trigger category." };
  if (!input.suggestItemId) return { error: "Pick the item to suggest." };

  const supabase = await createClient();
  const { error } = await supabase.from("upsell_prompts").insert({
    business_id: business.id,
    trigger_scope: scope,
    trigger_item_id: scope === "item" ? input.triggerItemId : null,
    trigger_category: scope === "category" ? input.triggerCategory : null,
    suggest_item_id: input.suggestItemId,
    label: (input.label || "").trim().slice(0, 120) || null,
    combo_discount: Math.max(0, r2(Number(input.comboDiscount) || 0)),
  });
  if (error) {
    console.error("addUpsellPrompt:", error);
    return { error: "Could not save the prompt." };
  }
  revalidatePath("/app/upsells");
  return { ok: true };
}

export async function setUpsellActive(id: string, active: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("upsell_prompts").update({ active }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not update." };
  revalidatePath("/app/upsells");
  return { ok: true };
}

export async function deleteUpsellPrompt(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("upsell_prompts").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/upsells");
  return { ok: true };
}
