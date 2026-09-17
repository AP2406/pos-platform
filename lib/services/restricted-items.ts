import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which of these catalog items may not be rung without a manager.
 *
 * `catalog_items.requires_manager_approval` is set in the catalog editor and was
 * enforced ONLY in the browser: register-client gates the add behind a manager
 * PIN modal, and createOrder's approval gate — the block commented "Server-side
 * approval gate (P0 security)" — checked discount, comp, line void, tax
 * exemption and service-charge waive, but never looked at whether the cart
 * contained a restricted item.
 *
 * A client gate is not a gate. The same argument as app/app/debug/guard.ts: a
 * server action is a POST to a build-time id that ships in the client bundle, so
 * anything that only the browser refuses can be asked for directly. The flag
 * exists to stop a cashier ringing a controlled item — a high-value bottle, a
 * comped staff meal, a gift card — without a manager, and that is precisely the
 * person motivated to bypass it.
 *
 * Returns NAMES, because they go into the operator-facing "a manager PIN is
 * required to approve: …" message, where "restricted item" alone tells a cashier
 * nothing about which line to remove.
 */
export async function restrictedItemNames(
  supabase: SupabaseClient,
  businessId: string,
  catalogItemIds: string[]
): Promise<string[]> {
  const ids = Array.from(new Set(catalogItemIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("catalog_items")
    .select("name")
    .eq("business_id", businessId)
    .in("id", ids)
    .eq("requires_manager_approval", true);

  if (error) {
    // Fail CLOSED. If we cannot tell whether the cart holds a restricted item,
    // the safe answer is that it might — a gate that opens when the database
    // hiccups is not a gate, and the cost of being wrong here is a manager
    // typing a PIN they did not strictly need to.
    console.error("restrictedItemNames:", error);
    return ["restricted item (could not verify)"];
  }
  return (data ?? []).map((r) => (r.name as string) || "restricted item");
}

/** The label the approval gate shows for a blocked cart. */
export function restrictedLabel(names: string[]): string {
  if (names.length === 0) return "restricted item";
  if (names.length === 1) return "manager-only item: " + names[0];
  return "manager-only items: " + names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : "");
}
