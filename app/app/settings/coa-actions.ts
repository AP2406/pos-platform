"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { COA_DEFAULTS, type CoaKey } from "../accounting/journal";

// Chart-of-accounts mapping for the QBO/Xero journal export. Stored on
// businesses.settings.coa (jsonb, merged). Owner/manager only.
export async function setCoa(
  input: { key: string; name: string; code: string }[]
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change this." };
  }

  const valid = new Set(Object.keys(COA_DEFAULTS) as CoaKey[]);
  const coa: Record<string, { name: string; code: string }> = {};
  for (const row of input) {
    if (!valid.has(row.key as CoaKey)) continue;
    coa[row.key] = {
      name: (row.name || "").trim().slice(0, 60),
      code: (row.code || "").trim().slice(0, 24),
    };
  }

  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const next = { ...current, coa };
  const { error } = await supabase.from("businesses").update({ settings: next }).eq("id", business.id);
  if (error) {
    console.error("setCoa:", error);
    return { error: "Could not save the mapping." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
