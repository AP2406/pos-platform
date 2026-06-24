import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { CONFIG_KEYS, SCOPE_PRECEDENCE, type BusinessLike, type ConfigScope } from "./registry";

// CUST-0 config resolver. getConfig returns the effective value by precedence
// user → role → location → business(org) → legacy(current storage) → default.
// loadOrgConfig is React-cached so the register/KDS hot paths do ONE batched
// read per request, not an N+1 of settings lookups.

export type ConfigCtx = {
  orgId: string;
  businessId: string;     // the active location
  roleId?: string | null; // the active staff role (PIN cashier), if any
  userId?: string | null; // the signed-in auth user
  business: BusinessLike; // for legacy adapters
};

type Row = { scope_type: string; scope_id: string; key: string; value: unknown };

const loadOrgConfig = cache(async (orgId: string): Promise<Row[]> => {
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("config_settings")
    .select("scope_type, scope_id, key, value")
    .eq("org_id", orgId);
  return (data ?? []) as Row[];
});

export type ConfigSource = "user" | "role" | "location" | "business" | "legacy" | "default";

export async function getConfigMeta<T = unknown>(key: string, ctx: ConfigCtx): Promise<{ value: T; source: ConfigSource; overridden: boolean }> {
  const def = CONFIG_KEYS[key];
  const rows = await loadOrgConfig(ctx.orgId);
  const idForScope: Record<Exclude<ConfigScope, "system">, string | null | undefined> = {
    user: ctx.userId, role: ctx.roleId, location: ctx.businessId, business: ctx.orgId,
  };
  for (const scope of SCOPE_PRECEDENCE) {
    const id = idForScope[scope];
    if (!id) continue;
    const row = rows.find((r) => r.scope_type === scope && r.scope_id === id && r.key === key);
    if (row) return { value: row.value as T, source: scope, overridden: true };
  }
  if (def?.legacy) {
    const lv = def.legacy(ctx.business);
    if (lv !== undefined && lv !== null) return { value: lv as T, source: "legacy", overridden: false };
  }
  return { value: (def?.default as T), source: "default", overridden: false };
}

export async function getConfig<T = unknown>(key: string, ctx: ConfigCtx): Promise<T> {
  return (await getConfigMeta<T>(key, ctx)).value;
}

// Build a resolver context from a requireBusiness() business row (+ optional
// active staff role). Reads the signed-in auth user for the user scope.
export async function configContext(business: BusinessLike & { id: string; org_id?: string | null }, opts?: { roleId?: string | null }): Promise<ConfigCtx> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return {
    orgId: (business.org_id as string) || "",
    businessId: business.id,
    roleId: opts?.roleId ?? null,
    userId: user ? user.id : null,
    business,
  };
}
