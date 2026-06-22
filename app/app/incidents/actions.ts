"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// D9: customer issue / incident log — qualitative complaint / allergy-incident
// records with resolution, distinct from the financial exceptions report.
const TYPES = ["complaint", "allergy", "injury", "service", "other"] as const;
const SEVERITIES = ["low", "medium", "high"] as const;

export async function addIncident(input: {
  type: string;
  severity: string;
  body: string;
}): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can log incidents." };
  const body = (input.body || "").trim().slice(0, 4000);
  if (!body) return { error: "Describe what happened." };
  const type = (TYPES as readonly string[]).includes(input.type) ? input.type : "complaint";
  const severity = (SEVERITIES as readonly string[]).includes(input.severity) ? input.severity : "medium";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("customer_incidents").insert({
    business_id: business.id,
    type,
    severity,
    body,
    status: "open",
    created_by: user ? user.id : null,
    created_by_name: user?.email ? (user.email as string).split("@")[0] : null,
  });
  if (error) {
    console.error("addIncident:", error);
    return { error: "Could not save the incident." };
  }
  revalidatePath("/app/incidents");
  return { ok: true };
}

export async function resolveIncident(id: string, resolution: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_incidents")
    .update({ status: "resolved", resolution: (resolution || "").trim().slice(0, 2000) || null, resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { error: "Could not resolve the incident." };
  revalidatePath("/app/incidents");
  return { ok: true };
}

export async function reopenIncident(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_incidents")
    .update({ status: "open", resolved_at: null })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { error: "Could not reopen the incident." };
  revalidatePath("/app/incidents");
  return { ok: true };
}

export async function deleteIncident(id: string): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Not allowed." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_incidents").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Could not delete the incident." };
  revalidatePath("/app/incidents");
  return { ok: true };
}
