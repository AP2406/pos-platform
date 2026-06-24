// Server-only helpers (not Server Actions — they take a SupabaseClient), so no
// "use server" directive here.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  resolvePermissions,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/lib/services/permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffPermissions = {
  staffId: string;
  name: string;
  legacyRole: string;
  keys: PermissionKey[];
  compCap: number | null; // max $ this role can comp without approval (null = unlimited)
  discountCap: number | null;
  discountPctCap: number | null; // CUST-1
  refundCap: number | null;
  voidWindowMin: number | null;
  can: (perm: PermissionKey) => boolean;
};

const PERM_SET = new Set<string>(PERMISSION_KEYS as readonly string[]);

// Resolves a staff member's effective permissions: their role's permissions
// (roles.permissions via role_id), else the default matrix on the legacy role
// enum, with per-user overrides (CUST-1) applied on top. Migration-resilient:
// the new staff_members/roles columns are read defensively so the register's
// sign-in path never breaks before 0070 is applied. Null if unknown/inactive.
export async function staffPermissionsById(
  supabase: SupabaseClient,
  businessId: string,
  staffId: string
): Promise<StaffPermissions | null> {
  let st = (await supabase.from("staff_members").select("id, name, role, role_id, is_active, permission_overrides").eq("id", staffId).eq("business_id", businessId).maybeSingle()).data as Record<string, unknown> | null;
  if (st === null) {
    st = (await supabase.from("staff_members").select("id, name, role, role_id, is_active").eq("id", staffId).eq("business_id", businessId).maybeSingle()).data as Record<string, unknown> | null;
  }
  if (!st || st.is_active === false) return null;

  let customPermissions: string[] | null = null;
  let compCap: number | null = null, discountCap: number | null = null;
  let discountPctCap: number | null = null, refundCap: number | null = null, voidWindowMin: number | null = null;
  if (st.role_id) {
    let r = (await supabase.from("roles").select("permissions, comp_cap, discount_cap, discount_pct_cap, refund_cap, void_window_min").eq("id", st.role_id as string).eq("business_id", businessId).maybeSingle()).data as Record<string, unknown> | null;
    if (r === null) {
      r = (await supabase.from("roles").select("permissions, comp_cap, discount_cap").eq("id", st.role_id as string).eq("business_id", businessId).maybeSingle()).data as Record<string, unknown> | null;
    }
    if (r) {
      if (Array.isArray(r.permissions)) customPermissions = r.permissions as string[];
      if (r.comp_cap != null) compCap = Number(r.comp_cap);
      if (r.discount_cap != null) discountCap = Number(r.discount_cap);
      if (r.discount_pct_cap != null) discountPctCap = Number(r.discount_pct_cap);
      if (r.refund_cap != null) refundCap = Number(r.refund_cap);
      if (r.void_window_min != null) voidWindowMin = Number(r.void_window_min);
    }
  }

  const set = resolvePermissions({ legacyRole: st.role as string, customPermissions });
  // CUST-1: per-user overrides — true grants, false revokes a single key.
  const overrides = (st.permission_overrides ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    if (!PERM_SET.has(k)) continue;
    if (v === true) set.add(k as PermissionKey);
    else if (v === false) set.delete(k as PermissionKey);
  }

  return {
    staffId: st.id as string,
    name: st.name as string,
    legacyRole: st.role as string,
    keys: Array.from(set),
    compCap, discountCap, discountPctCap, refundCap, voidWindowMin,
    can: (perm: PermissionKey) => set.has(perm),
  };
}

// True if the given staff member holds the permission (false if unknown).
export async function actorCan(
  supabase: SupabaseClient,
  businessId: string,
  staffId: string,
  permission: PermissionKey
): Promise<boolean> {
  const p = await staffPermissionsById(supabase, businessId, staffId);
  return p?.can(permission) ?? false;
}

// Verifies an approver PIN and that the resolved staff member holds the required
// permission (managers do by default, plus any custom role granted it).
export async function approverByPin(
  supabase: SupabaseClient,
  businessId: string,
  pin: string | undefined,
  permission: PermissionKey
): Promise<{ id: string; name: string } | null> {
  if (!pin || !/^[0-9]{4,6}$/.test(pin)) return null;
  const { data } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: businessId,
    p_pin: pin,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const perms = await staffPermissionsById(supabase, businessId, row.id as string);
  if (!perms || !perms.can(permission)) return null;
  return { id: row.id as string, name: row.name as string };
}

// The currently signed-in cashier's permissions (from the surge_active_staff
// cookie), or null if no one is signed in.
export async function getActiveStaffPermissions(): Promise<StaffPermissions | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get("surge_active_staff")?.value || null;
  if (!sid) return null;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  return staffPermissionsById(supabase, business.id, sid);
}
