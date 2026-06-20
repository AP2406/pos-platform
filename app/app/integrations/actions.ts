"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import type { IntegrationKey } from "@/lib/services/integrations";
import { finixPing } from "@/lib/services/finix";

const KEYS = new Set<IntegrationKey>([
  "finix_cards", "bar_tab", "qbo", "xero", "settlement", "delivery", "reservations_sync",
]);

// Toggle a per-business integration flag (settings.integrations.<key>). Enabling a
// connector whose server credentials are absent is allowed but a no-op until they
// exist — the feature degrades gracefully.
export async function setIntegrationEnabled(
  key: string,
  enabled: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!KEYS.has(key as IntegrationKey)) return { error: "Unknown integration." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can change integrations." };
  }
  const supabase = await createClient();
  const current = ((business as { settings?: Record<string, unknown> }).settings ?? {}) as Record<string, unknown>;
  const integrations = { ...((current.integrations ?? {}) as Record<string, unknown>), [key]: enabled };
  const { error } = await supabase
    .from("businesses")
    .update({ settings: { ...current, integrations } })
    .eq("id", business.id);
  if (error) {
    console.error("setIntegrationEnabled:", error);
    return { error: "Could not save." };
  }
  revalidatePath("/app/integrations");
  return { ok: true };
}

// Live "Test connection". Finix-backed connectors actually ping the Finix API;
// others have no test until their live wiring lands (returns a clear message).
export async function testIntegration(key: string): Promise<{ ok: true; detail: string } | { error: string }> {
  const { role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can test integrations." };
  if (key === "finix_cards" || key === "bar_tab" || key === "settlement") {
    const res = await finixPing();
    if ("error" in res) return { error: res.error };
    return { ok: true, detail: "Finix reachable — " + res.detail };
  }
  return { error: "No live test yet — add credentials and the connector's wiring lands per its checklist." };
}
