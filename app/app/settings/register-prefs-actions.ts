"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// Register-behavior toggles (TouchBistro "Advanced" parity). Stored on
// businesses.settings.register {...}. All booleans; the register/checkout read
// them to adjust behavior. Additive — unset = the prior default.
export type RegisterPrefs = {
  auto_proceed: boolean; // jump straight into order entry when a table/tile is tapped
  send_all: boolean; // show a "Send all" button in order entry
  email_receipt_prompt: boolean; // offer "Email receipt" after checkout
  auto_close_forced_modifiers: boolean; // close the modifier sheet once required groups are met
  allow_discounts_on_alcohol: boolean; // permit line discounts on alcohol sales-category items
  show_modifier_category: boolean; // show the modifier group name on the line
  default_to_seat: boolean; // default new items to Seat 1 in table mode
  lock_menu_view: boolean; // hide the grid/list menu-view toggle
};

const KEYS: (keyof RegisterPrefs)[] = [
  "auto_proceed",
  "send_all",
  "email_receipt_prompt",
  "auto_close_forced_modifiers",
  "allow_discounts_on_alcohol",
  "show_modifier_category",
  "default_to_seat",
  "lock_menu_view",
];

export async function setRegisterPrefs(input: Partial<RegisterPrefs>): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const currentReg = (current.register ?? {}) as Record<string, unknown>;
  const nextReg: Record<string, boolean> = { ...(currentReg as Record<string, boolean>) };
  for (const k of KEYS) {
    if (typeof input[k] === "boolean") nextReg[k] = input[k] as boolean;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, register: nextReg } })
    .eq("id", business.id);
  if (error) {
    console.error("setRegisterPrefs:", error);
    return { error: "Could not save the setting." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  return { ok: true };
}
