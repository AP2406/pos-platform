"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D6: open/close/changeover checklists. Templates are manager-defined; instances
// are per-business-day completions with sign-off (who + when).
const SEGMENTS = ["open", "close", "changeover"] as const;

function businessDateFor(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function addTemplate(input: { label: string; segment: string; assignee?: string }): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can edit the checklist." };
  const label = (input.label || "").trim().slice(0, 200);
  if (!label) return { error: "Add the task text." };
  const segment = (SEGMENTS as readonly string[]).includes(input.segment) ? input.segment : "open";
  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").insert({
    business_id: business.id,
    label,
    segment,
    assignee: (input.assignee || "").trim().slice(0, 80) || null,
  });
  if (error) { console.error("addTemplate:", error); return { error: "Could not add the task." }; }
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete the task." };
  revalidatePath("/app/checklists");
  return { ok: true };
}

export async function completeTask(templateId: string, pin?: string): Promise<{ ok: true; name: string | null } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";

  let name: string | null = null;
  if (pin && /^[0-9]{4,6}$/.test(pin)) {
    const { data } = await supabase.rpc("verify_staff_member_pin", { p_business_id: business.id, p_pin: pin });
    const row = Array.isArray(data) ? data[0] : data;
    name = row ? (row.name as string) : null;
  }

  const { error } = await supabase.from("task_instances").upsert(
    { business_id: business.id, template_id: templateId, business_date: businessDateFor(tz), completed_by_name: name, completed_at: new Date().toISOString() },
    { onConflict: "template_id,business_date" }
  );
  if (error) { console.error("completeTask:", error); return { error: "Could not mark the task done." }; }
  revalidatePath("/app/checklists");
  return { ok: true, name };
}

export async function uncompleteTask(templateId: string): Promise<{ ok: true } | { error: string }> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const tz = (business as { timezone?: string }).timezone || "America/Toronto";
  const { error } = await supabase
    .from("task_instances")
    .delete()
    .eq("business_id", business.id)
    .eq("template_id", templateId)
    .eq("business_date", businessDateFor(tz));
  if (error) return { error: "Could not clear the task." };
  revalidatePath("/app/checklists");
  return { ok: true };
}
