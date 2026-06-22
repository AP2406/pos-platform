"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D5: employee write-up / commendation / coaching log. HR-sensitive — owner/
// manager only (enforced by RLS + here).
const TYPES = ["writeup", "commendation", "coaching"] as const;

export async function addWriteup(input: {
  staffId: string;
  type: string;
  occurredOn: string;
  body: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can add records." };
  if (!input.staffId) return { error: "Pick an employee." };
  const body = (input.body || "").trim().slice(0, 4000);
  if (!body) return { error: "Write the details." };
  const type = (TYPES as readonly string[]).includes(input.type) ? input.type : "writeup";
  const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn) ? input.occurredOn : new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("staff_writeups").insert({
    business_id: business.id,
    staff_id: input.staffId,
    author_id: user ? user.id : null,
    author_name: user?.email ? (user.email as string).split("@")[0] : null,
    type,
    body,
    occurred_on: occurredOn,
  });
  if (error) {
    console.error("addWriteup:", error);
    return { error: "Could not save the record." };
  }
  revalidatePath("/app/staff-records");
  return { ok: true };
}

export async function deleteWriteup(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_writeups").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete the record." };
  revalidatePath("/app/staff-records");
  return { ok: true };
}
