"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import type { PriceWindow } from "@/lib/services/price-windows";
import { rowToWindow } from "@/lib/services/price-windows";

// E1 happy-hour price windows — owner/manager CRUD.
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function listPriceWindows(activeOnly = false): Promise<(PriceWindow & { active: boolean })[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  let q = supabase.from("price_windows").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []).map((r) => ({ ...rowToWindow(r), active: r.active !== false }));
}

export async function addPriceWindow(input: {
  name: string;
  scope: "item" | "category";
  targetItemId?: string | null;
  targetCategory?: string | null;
  days: number[];
  startMin: number;
  endMin: number;
  mode: "price" | "percent";
  value: number;
  priority?: number;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can set pricing." };
  const name = (input.name || "Happy hour").trim().slice(0, 80);
  const scope = input.scope === "category" ? "category" : "item";
  if (scope === "item" && !input.targetItemId) return { error: "Pick an item." };
  if (scope === "category" && !input.targetCategory) return { error: "Pick a category." };
  const value = r2(Number(input.value) || 0);
  if (input.mode === "percent" && (value <= 0 || value > 100)) return { error: "Percent off must be 1–100." };
  if (input.mode === "price" && value < 0) return { error: "Price can't be negative." };
  const days = (input.days || []).filter((d) => d >= 0 && d <= 6);
  const startMin = Math.min(1440, Math.max(0, Math.round(Number(input.startMin) || 0)));
  const endMin = Math.min(1440, Math.max(0, Math.round(Number(input.endMin) || 0)));

  const supabase = await createClient();
  const { error } = await supabase.from("price_windows").insert({
    business_id: business.id,
    name,
    scope,
    target_item_id: scope === "item" ? input.targetItemId : null,
    target_category: scope === "category" ? input.targetCategory : null,
    days,
    start_min: startMin,
    end_min: endMin,
    mode: input.mode === "price" ? "price" : "percent",
    value,
    priority: Math.round(Number(input.priority) || 0),
  });
  if (error) {
    console.error("addPriceWindow:", error);
    return { error: "Could not save the price window." };
  }
  revalidatePath("/app/pricing");
  return { ok: true };
}

export async function setPriceWindowActive(id: string, active: boolean): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("price_windows").update({ active }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not update." };
  revalidatePath("/app/pricing");
  return { ok: true };
}

export async function deletePriceWindow(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("price_windows").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete." };
  revalidatePath("/app/pricing");
  return { ok: true };
}
