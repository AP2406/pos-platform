"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

const ALLOWED_REASONS = ["receive", "adjustment", "damage", "initial", "recount"];

export async function saveInventorySettings(
  itemId: string,
  track: boolean,
  reorderPoint: number,
  barcode: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!itemId) return { error: "Missing item." };
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const rp = Math.max(0, Math.round((Number(reorderPoint) || 0) * 100) / 100);
  const bc = barcode && barcode.trim() ? barcode.trim().slice(0, 80) : null;

  const { error } = await supabase
    .from("catalog_items")
    .update({ track_inventory: !!track, reorder_point: rp, barcode: bc })
    .eq("id", itemId)
    .eq("business_id", business.id);

  if (error) {
    console.error("saveInventorySettings:", error);
    return { error: "Could not save settings. Please try again." };
  }
  revalidatePath("/app/inventory");
  return { ok: true };
}

export async function adjustStock(
  itemId: string,
  change: number,
  reason: string,
  note?: string
): Promise<{ ok: true; new_qty: number } | { error: string }> {
  if (!itemId) return { error: "Missing item." };
  const chg = Math.round((Number(change) || 0) * 100) / 100;
  if (chg === 0) return { error: "Enter a non-zero amount." };
  const r = ALLOWED_REASONS.includes(reason) ? reason : "adjustment";

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("id", itemId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const { data, error } = await supabase.rpc("apply_inventory_change", {
    p_business_id: business.id,
    p_item_id: itemId,
    p_change: chg,
    p_reason: r,
    p_note: note && note.trim() ? note.trim().slice(0, 300) : null,
    p_order_id: null,
  });

  if (error || data === null || data === undefined) {
    console.error("adjustStock:", error);
    return { error: "Could not adjust stock. Please try again." };
  }

  revalidatePath("/app/inventory");
  return { ok: true, new_qty: Number(data) };
}