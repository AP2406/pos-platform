"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

const ALLOWED_KEYS = ["legal_accepted", "tax_free", "cash_only"];

// Form action. Stores a manual go-live confirmation on businesses.go_live.
// Auto-detected checks (catalog, register, Finix approval) are NOT stored here;
// they are read live on the page.
export async function setGoLiveFlag(formData: FormData): Promise<void> {
  const key = String(formData.get("key") || "");
  const value = String(formData.get("value") || "true") === "true";
  if (!ALLOWED_KEYS.includes(key)) return;

  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("businesses")
    .select("go_live")
    .eq("id", business.id)
    .maybeSingle();

  const current =
    row && row.go_live && typeof row.go_live === "object"
      ? (row.go_live as Record<string, unknown>)
      : {};
  const next: Record<string, unknown> = { ...current };
  next[key] = value;
  if (key === "legal_accepted" && value) {
    next["legal_accepted_at"] = new Date().toISOString();
  }

  await supabase.from("businesses").update({ go_live: next }).eq("id", business.id);
  revalidatePath("/app/go-live");
}