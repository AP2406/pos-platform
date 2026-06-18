"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness, assertConfigEditable } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { PERMISSION_KEYS } from "@/lib/services/permissions";

export type RoleRow = {
  id: string;
  name: string;
  key: string | null;
  is_system: boolean;
  permissions: string[];
  compCap: number | null;
  discountCap: number | null;
  sort_order: number;
};

function canManage(role: string): boolean {
  return role === "owner" || role === "manager";
}

function cleanPerms(perms: string[]): string[] {
  const allowed = new Set(PERMISSION_KEYS as readonly string[]);
  return Array.from(new Set(perms.filter((p) => allowed.has(p))));
}

export async function listRoles(): Promise<RoleRow[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, key, is_system, permissions, comp_cap, discount_cap, sort_order")
    .eq("business_id", business.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    key: (r.key as string | null) ?? null,
    is_system: !!r.is_system,
    permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    compCap: r.comp_cap != null ? Number(r.comp_cap) : null,
    discountCap: r.discount_cap != null ? Number(r.discount_cap) : null,
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
  compCap: number | null,
  discountCap: number | null
): Promise<{ ok: true } | { error: string }> {
  if (!roleId) return { error: "Missing role." };
  const { business, role } = await requireBusiness();
  assertConfigEditable(business);
  if (!canManage(role)) return { error: "Only an owner or manager can edit roles." };

  const clamp = (v: number | null): number | null => {
    if (v == null || !Number.isFinite(v) || v <= 0) return null; // 0/blank = unlimited
    return Math.min(100000, Math.round(v * 100) / 100);
  };
  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ comp_cap: clamp(compCap), discount_cap: clamp(discountCap) })
    .eq("id", roleId)
    .eq("business_id", business.id);
  if (error) {
    console.error("setRoleCaps:", error);
    return { error: "Could not save the caps." };
  }
  revalidatePath("/app/settings");
  return { ok: true };
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
