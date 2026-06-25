"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { extractMenuItems, extractMenuItemsFromUrl, type ParsedMenuItem } from "@/lib/services/menu-import";

export async function parseMenuUpload(input: {
  name: string;
  mimeType: string;
  base64: string;
}): Promise<{ ok: true; items: ParsedMenuItem[] } | { error: string }> {
  const { role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can import a menu." };
  }
  if (!input || !input.base64) return { error: "No file received." };

  try {
    const items = await extractMenuItems({
      name: input.name || "",
      mimeType: input.mimeType || "",
      base64: input.base64,
    });
    if (items.length === 0) {
      return { error: "No menu items were found in that file." };
    }
    return { ok: true, items: items };
  } catch (e) {
    console.error("parseMenuUpload:", e);
    const msg = e instanceof Error ? e.message : "Could not read that file.";
    return { error: msg };
  }
}

// GAP-2.2: import a menu from a pasted URL (owner/manager).
export async function parseMenuUrl(url: string): Promise<{ ok: true; items: ParsedMenuItem[] } | { error: string }> {
  const { role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can import a menu." };
  }
  if (!url || !url.trim()) return { error: "Paste a menu link." };

  try {
    const items = await extractMenuItemsFromUrl(url.trim());
    if (items.length === 0) return { error: "No menu items were found at that link." };
    return { ok: true, items: items };
  } catch (e) {
    console.error("parseMenuUrl:", e);
    const msg = e instanceof Error ? e.message : "Could not read that link.";
    return { error: msg };
  }
}

export async function bulkCreateCatalogItems(
  items: { name: string; price: number; category: string | null }[]
): Promise<{ ok: true; created: number } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can add items." };
  }

  const clean = (items ?? [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim().length > 0)
    .map((i) => ({
      business_id: business.id,
      name: i.name.trim().slice(0, 120),
      price:
        typeof i.price === "number" && isFinite(i.price) && i.price >= 0
          ? Math.round(i.price * 100) / 100
          : 0,
      category: i.category && i.category.trim() ? i.category.trim().slice(0, 60) : null,
      taxable: true,
    }));

  if (clean.length === 0) return { error: "No valid items to add." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .insert(clean)
    .select("id");
  if (error) {
    console.error("bulkCreateCatalogItems:", error);
    return { error: "Could not add the items. Please try again." };
  }

  revalidatePath("/app/catalog");
  return { ok: true, created: (data ?? []).length };
}