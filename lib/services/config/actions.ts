"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { CONFIG_KEYS, coerceConfigValue, type ConfigScope } from "./registry";
import { configContext, getConfigMeta } from "./resolver";
import { revalidatePath } from "next/cache";

// CUST-0 config writes. Every change is audited (config_change). Business /
// location / role scopes require owner/manager (the manage_settings permission)
// + a config-editable (non-demo) tenant; the `user` scope is self-only and
// never touches access. RLS is the backstop for all of this.

type WScope = Exclude<ConfigScope, "system">;

async function guard(scopeType: WScope, scopeId: string) {
  const { business, role } = await requireBusiness();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const orgId = ((business as { org_id?: string | null }).org_id as string) || "";
  if (!orgId) return { error: "Org not initialized — run migration 0069." } as const;

  if (scopeType === "user") {
    if (!user || scopeId !== user.id) return { error: "You can only change your own preference." } as const;
    return { ok: true, supabase, business, role, user, orgId } as const;
  }
  // Non-user scopes: owner/manager only, non-demo, and the scope id must belong
  // to this org.
  try { assertConfigEditable(business); } catch { return { error: "This is a demo workspace — settings are locked." } as const; }
  if (role !== "owner" && role !== "manager") return { error: "You don't have permission to change this." } as const;
  if (scopeType === "business") {
    if (scopeId !== orgId) return { error: "Invalid business scope." } as const;
  } else if (scopeType === "location") {
    const { data } = await supabase.from("businesses").select("id").eq("id", scopeId).eq("org_id", orgId).maybeSingle();
    if (!data) return { error: "That location isn't in your organization." } as const;
  } else if (scopeType === "role") {
    const { data } = await supabase.from("roles").select("id").eq("id", scopeId).eq("business_id", business.id).maybeSingle();
    if (!data) return { error: "Unknown role." } as const;
  }
  return { ok: true, supabase, business, role, user, orgId } as const;
}

export async function setConfig(key: string, scopeType: WScope, scopeId: string, value: unknown): Promise<{ ok: true } | { error: string }> {
  const def = CONFIG_KEYS[key];
  if (!def) return { error: "Unknown setting." };
  if (!def.scopes.includes(scopeType)) return { error: "This setting can't be set at that level." };
  const coerced = coerceConfigValue(def, value);
  if (coerced === null) return { error: "That value isn't allowed for this setting." };

  const g = await guard(scopeType, scopeId);
  if ("error" in g) return g;
  const { supabase, business, role, user, orgId } = g;

  const { data: existing } = await supabase.from("config_settings").select("value").eq("scope_type", scopeType).eq("scope_id", scopeId).eq("key", key).maybeSingle();
  const { error } = await supabase.from("config_settings").upsert(
    { org_id: orgId, scope_type: scopeType, scope_id: scopeId, key, value: coerced as object, updated_by: user ? user.id : null, updated_at: new Date().toISOString() },
    { onConflict: "scope_type,scope_id,key" }
  );
  if (error) { console.error("setConfig:", error); return { error: "Could not save the setting." }; }

  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "config_change",
    metadata: { key, scope: scopeType, scope_id: scopeId, old: existing?.value ?? null, new: coerced },
  });
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function resetConfig(key: string, scopeType: WScope, scopeId: string): Promise<{ ok: true } | { error: string }> {
  if (!CONFIG_KEYS[key]) return { error: "Unknown setting." };
  const g = await guard(scopeType, scopeId);
  if ("error" in g) return g;
  const { supabase, business, role, user } = g;

  const { data: existing } = await supabase.from("config_settings").select("value").eq("scope_type", scopeType).eq("scope_id", scopeId).eq("key", key).maybeSingle();
  const { error } = await supabase.from("config_settings").delete().eq("scope_type", scopeType).eq("scope_id", scopeId).eq("key", key);
  if (error) return { error: "Could not reset the setting." };
  if (existing) {
    await supabase.from("audit_events").insert({
      business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
      action: "config_change", metadata: { key, scope: scopeType, scope_id: scopeId, old: existing.value ?? null, new: null, reset: true },
    });
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setUserPref(key: string, value: unknown): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  return setConfig(key, "user", user.id, value);
}

export async function resetUserPref(key: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  return resetConfig(key, "user", user.id);
}

// For the ConfigField UI: the resolved value + source + the override actually set
// at each scope (business/location/user) for the active context.
export type ConfigOverview = {
  key: string;
  resolved: unknown;
  source: string;
  overridden: boolean;
  atBusiness: unknown | undefined;
  atLocation: unknown | undefined;
  atUser: unknown | undefined;
};

export async function getConfigOverview(key: string): Promise<ConfigOverview | null> {
  const def = CONFIG_KEYS[key];
  if (!def) return null;
  const { business } = await requireBusiness();
  const ctx = await configContext(business as never);
  const meta = await getConfigMeta(key, ctx);
  const supabase = await createClient();
  const orgId = ((business as { org_id?: string | null }).org_id as string) || "";
  const { data } = await supabase
    .from("config_settings")
    .select("scope_type, scope_id, value")
    .eq("org_id", orgId)
    .eq("key", key);
  const rows = data ?? [];
  const at = (scope: string, id: string | null | undefined) => (id ? rows.find((r) => r.scope_type === scope && r.scope_id === id)?.value : undefined);
  return {
    key,
    resolved: meta.value,
    source: meta.source,
    overridden: meta.overridden,
    atBusiness: at("business", ctx.orgId),
    atLocation: at("location", ctx.businessId),
    atUser: at("user", ctx.userId),
  };
}
