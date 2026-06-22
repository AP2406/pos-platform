"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D2: manager shift log / "red book" — narrative handoff notes, distinct from
// the system audit log. Owner/manager write; any member can read.
const CATEGORIES = ["note", "incident", "maintenance", "cash", "weather"] as const;

export async function addShiftLog(input: {
  category: string;
  body: string;
  shiftDate: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can write to the log." };
  const body = (input.body || "").trim().slice(0, 4000);
  if (!body) return { error: "Write something first." };
  const category = (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "note";
  const shiftDate = /^\d{4}-\d{2}-\d{2}$/.test(input.shiftDate) ? input.shiftDate : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("shift_logs").insert({
    business_id: business.id,
    author_id: user ? user.id : null,
    author_name: user?.email ? (user.email as string).split("@")[0] : null,
    shift_date: shiftDate,
    category,
    body,
  });
  if (error) {
    console.error("addShiftLog:", error);
    return { error: "Could not save the entry." };
  }
  revalidatePath("/app/log");
  return { ok: true };
}

export async function deleteShiftLog(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("shift_logs").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete the entry." };
  revalidatePath("/app/log");
  return { ok: true };
}
