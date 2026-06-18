// Server-only helpers (not Server Actions — they take a SupabaseClient), so no
// "use server" directive here.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import {
  resolvePermissions,
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
  can: (perm: PermissionKey) => boolean;
};

// Resolves a staff member's effective permissions: prefers their assigned role's
// permissions (roles.permissions via role_id), else falls back to the default
// matrix keyed on the legacy role enum. Returns null if the staff id is unknown
// or inactive for this business.
export async function staffPermissionsById(
  supabase: SupabaseClient,
  businessId: string,
  staffId: string
): Promise<StaffPermissions | null> {
  const { data: st } = await supabase
    .from("staff_members")
    .select("id, name, role, role_id, is_active")
    .eq("id", staffId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!st || st.is_active === false) return null;

  let customPermissions: string[] | null = null;
  let compCap: number | null = null;
  let discountCap: number | null = null;
  if (st.role_id) {
    const { data: r } = await supabase
      .from("roles")
      .select("permissions, comp_cap, discount_cap")
      .eq("id", st.role_id as string)
      .eq("business_id", businessId)
      .maybeSingle();
    if (r && Array.isArray(r.permissions)) {
      customPermissions = r.permissions as string[];
    }
    if (r && r.comp_cap != null) compCap = Number(r.comp_cap);
    if (r && r.discount_cap != null) discountCap = Number(r.discount_cap);
  }

  const set = resolvePermissions({
    legacyRole: st.role as string,
    customPermissions,
  });
  return {
    staffId: st.id as string,
    name: st.name as string,
    legacyRole: st.role as string,
    keys: Array.from(set),
    compCap,
    discountCap,
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
