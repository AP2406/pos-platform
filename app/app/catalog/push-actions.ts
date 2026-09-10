"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, listBusinesses } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { canAccess } from "@/lib/services/route-access";

// Same matrix the pages and the sidebar use, so a role that can see this
// screen can act on it — and the two can never drift apart.
function canManage(role: string): boolean {
  return canAccess(role, "edit_menu");
}

export type PushResult = {
  business_id: string;
  name: string;
  created: number;
  updated: number;
};

// Push selected menu items from the current business to other locations the user
// manages. Items are matched by name (case-insensitive). Existing matches are
// updated (category, taxable, image) but their price is preserved as a per-location
// override unless `overwritePrices` is set. Business-specific fields (tax rate,
// station, course) are never copied. dryRun returns the counts without writing.
export async function pushMenu(input: {
  targetIds: string[];
  itemIds: string[];
  overwritePrices: boolean;
  dryRun: boolean;
}): Promise<{ ok: true; results: PushResult[] } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can push menus." };

  const all = await listBusinesses();
  const managed = new Set(
    all.filter((b) => b.role === "owner" || b.role === "manager").map((b) => b.id)
  );
  const targets = (input.targetIds || []).filter((id) => id !== business.id && managed.has(id));
  if (targets.length === 0) return { error: "Pick at least one other location to push to." };
  if (!input.itemIds || input.itemIds.length === 0) return { error: "Pick at least one item to push." };

  const supabase = await createClient();

  const { data: src } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, taxable, image_url")
    .eq("business_id", business.id)
    .in("id", input.itemIds);
  if (!src || src.length === 0) return { error: "None of the selected items were found." };

  const results: PushResult[] = [];

  for (const t of targets) {
    const { data: existing } = await supabase
      .from("catalog_items")
      .select("id, name")
      .eq("business_id", t);
    const byName = new Map(
      (existing ?? []).map((e) => [String(e.name).trim().toLowerCase(), e.id as string])
    );

    let created = 0;
    let updated = 0;
    const toInsert: Record<string, unknown>[] = [];

    for (const it of src) {
      const key = String(it.name).trim().toLowerCase();
      const matchId = byName.get(key);
      if (matchId) {
        updated += 1;
        if (!input.dryRun) {
          const patch: Record<string, unknown> = {
            category: it.category,
            taxable: it.taxable,
            image_url: it.image_url,
          };
          if (input.overwritePrices) patch.price = it.price;
          const { error } = await supabase
            .from("catalog_items")
            .update(patch)
            .eq("id", matchId)
            .eq("business_id", t);
          if (error) {
            console.error("pushMenu update:", error);
            return { error: "Could not update items at a target location. Nothing further was changed." };
          }
        }
      } else {
        created += 1;
        if (!input.dryRun) {
          toInsert.push({
            business_id: t,
            name: it.name,
            price: it.price,
            category: it.category,
            taxable: it.taxable,
            image_url: it.image_url,
            is_active: true,
          });
        }
      }
    }

    if (!input.dryRun && toInsert.length > 0) {
      const { error } = await supabase.from("catalog_items").insert(toInsert);
      if (error) {
        console.error("pushMenu insert:", error);
        return { error: "Could not add new items at a target location." };
      }
    }

    results.push({
      business_id: t,
      name: all.find((b) => b.id === t)?.name ?? "Location",
      created,
      updated,
    });
  }

  if (!input.dryRun) revalidatePath("/app/catalog");
  return { ok: true, results };
}
