"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { PERMISSION_KEYS } from "@/lib/services/permissions";
import { NAV_MODULES } from "@/lib/nav-modules";
import { canAccess } from "@/lib/services/route-access";

export type RoleRow = {
  id: string;
  name: string;
  key: string | null;
  is_system: boolean;
  permissions: string[];
  compCap: number | null;
  discountCap: number | null;
  discountPctCap: number | null;
  refundCap: number | null;
  voidWindowMin: number | null;
  hiddenNav: string[];
  sort_order: number;
};

// Same matrix the pages and the sidebar use, so a role that can see this
// screen can act on it — and the two can never drift apart.
function canManage(role: string): boolean {
  return canAccess(role, "edit_staff");
}

function cleanPerms(perms: string[]): string[] {
  const allowed = new Set(PERMISSION_KEYS as readonly string[]);
  return Array.from(new Set(perms.filter((p) => allowed.has(p))));
}

export async function listRoles(): Promise<RoleRow[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  // Migration-resilient: fall back to the pre-0070 columns if the new ones
  // aren't there yet (the new caps/nav just read as null until applied).
  const fetchRoles = async (cols: string) =>
    supabase.from("roles").select(cols).eq("business_id", business.id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  const full = await fetchRoles("id, name, key, is_system, permissions, comp_cap, discount_cap, discount_pct_cap, refund_cap, void_window_min, hidden_nav, sort_order");
  const data = (full.error ? (await fetchRoles("id, name, key, is_system, permissions, comp_cap, discount_cap, sort_order")).data : full.data) as Record<string, unknown>[] | null;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    key: (r.key as string | null) ?? null,
    is_system: !!r.is_system,
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    compCap: r.comp_cap != null ? Number(r.comp_cap) : null,
    discountCap: r.discount_cap != null ? Number(r.discount_cap) : null,
    discountPctCap: r.discount_pct_cap != null ? Number(r.discount_pct_cap) : null,
    refundCap: r.refund_cap != null ? Number(r.refund_cap) : null,
    voidWindowMin: r.void_window_min != null ? Number(r.void_window_min) : null,
    hiddenNav: Array.isArray(r.hidden_nav) ? (r.hidden_nav as string[]) : [],
    sort_order: Number(r.sort_order) || 0,
  }));
}

export async function updateRolePermissions(
  roleId: string,
  permissions: string[]
): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can edit roles." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ permissions: cleanPerms(permissions) })
    .eq("id", roleId)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateRolePermissions:", error);
    return { error: "Could not save the role. Please try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function setRoleCaps(
  roleId: string,
  caps: { compCap?: number | null; discountCap?: number | null; discountPctCap?: number | null; refundCap?: number | null; voidWindowMin?: number | null }
): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can edit roles." };

  const clamp = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null; // 0/blank = unlimited
    return Math.min(100000, Math.round(v * 100) / 100);
  };
  const clampPct = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return Math.min(100, Math.round(v * 100) / 100);
  };
  const clampInt = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null;
    return Math.min(1440, Math.round(v));
  };
  const supabase = await createClient();
  let res = await supabase
    .from("roles")
    .update({
      comp_cap: clamp(caps.compCap), discount_cap: clamp(caps.discountCap),
      discount_pct_cap: clampPct(caps.discountPctCap), refund_cap: clamp(caps.refundCap),
      void_window_min: clampInt(caps.voidWindowMin),
    })
    .eq("id", roleId)
    .eq("business_id", business.id);
  if (res.error) {
    // Pre-0070 fallback: persist the original two caps so existing behavior holds.
    res = await supabase
      .from("roles")
      .update({ comp_cap: clamp(caps.compCap), discount_cap: clamp(caps.discountCap) })
      .eq("id", roleId)
      .eq("business_id", business.id);
  }
  if (res.error) {
    console.error("setRoleCaps:", res.error);
    return { error: "Could not save the caps." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

// CUST-1: per-role nav visibility — the optional modules this role can't see.
export async function setRoleHiddenNav(roleId: string, hidden: string[]): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can change visibility." };
  const allowed = new Set(NAV_MODULES.map((m) => m.href));
  const clean = Array.from(new Set((hidden || []).filter((h) => allowed.has(h))));
  const supabase = await createClient();
  const { error } = await supabase.from("roles").update({ hidden_nav: clean }).eq("id", roleId).eq("business_id", business.id);
  if (error) {
    // Pre-0070 (column doesn't exist): degrade silently so the rest of the role
    // save still succeeds; nav visibility activates once the migration runs.
    if ((error as { code?: string }).code === "42703") return { ok: true };
    console.error("setRoleHiddenNav:", error);
    return { error: "Could not save nav visibility." };
  }
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { ok: true };
}

// Rename any role (display name only; key/is_system unchanged).
export async function renameRole(roleId: string, name: string): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Name is required." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can rename roles." };
  const supabase = await createClient();
  const { error } = await supabase.from("roles").update({ name: clean }).eq("id", roleId).eq("business_id", business.id);
  if (error) {
    const dup = (error as { code?: string } | null)?.code === "23505";
    return { error: dup ? "A role with that name already exists." : "Could not rename the role." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}

// Clone a role's permissions + caps into a new custom role.
export async function cloneRole(roleId: string, name: string): Promise<{ ok: true; id: string } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Name is required." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can clone roles." };

  const supabase = await createClient();
  const { data: src } = await supabase
    .from("roles")
    .select("permissions, comp_cap, discount_cap, discount_pct_cap, refund_cap, void_window_min, hidden_nav")
    .eq("id", roleId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!src) return { error: "Role to clone not found." };

  const { data: maxRow } = await supabase.from("roles").select("sort_order").eq("business_id", business.id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("roles")
    .insert({
      business_id: business.id, name: clean, is_system: false,
      permissions: cleanPerms(Array.isArray(src.permissions) ? (src.permissions as string[]) : []),
      comp_cap: src.comp_cap, discount_cap: src.discount_cap, discount_pct_cap: src.discount_pct_cap,
      refund_cap: src.refund_cap, void_window_min: src.void_window_min, hidden_nav: src.hidden_nav ?? [],
      sort_order: (Number(maxRow?.sort_order) || 0) + 1,
    })
    .select("id")
    .single();
  if (error || !data) {
    const dup = (error as { code?: string } | null)?.code === "23505";
    return { error: dup ? "A role with that name already exists." : "Could not clone the role." };
  }
  revalidatePath("/app/settings");
  return { ok: true, id: data.id as string };
}

export async function createRole(
  name: string
): Promise<{ ok: true; id: string } | { error: string }> {
  const clean = (name || "").trim().slice(0, 40);
  if (!clean) return { error: "Name is required." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can add roles." };

  const supabase = await createClient();
  const { data: maxRow } = await supabase
    .from("roles")
    .select("sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (Number(maxRow?.sort_order) || 0) + 1;

  const { data, error } = await supabase
    .from("roles")
    .insert({
      business_id: business.id,
      name: clean,
      is_system: false,
      permissions: [],
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createRole:", error);
    const dup = (error as { code?: string } | null)?.code === "23505";
    return { error: dup ? "A role with that name already exists." : "Could not add the role." };
  }
  revalidatePath("/app/settings");
  return { ok: true, id: data.id as string };
}

export async function deleteRole(roleId: string): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can delete roles." };

  const supabase = await createClient();
  // Never delete a system role.
  const { data: target } = await supabase
    .from("roles")
    .select("id, is_system")
    .eq("id", roleId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!target) return { error: "Role not found." };
  if (target.is_system) return { error: "The built-in roles can't be deleted." };

  // Block deletion while staff are still assigned to it.
  const { count } = await supabase
    .from("staff_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("role_id", roleId);
  if ((count ?? 0) > 0) {
    return { error: "Reassign the staff on this role before deleting it." };
  }

  const { error } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("business_id", business.id);
  if (error) {
    console.error("deleteRole:", error);
    return { error: "Could not delete the role." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
}
