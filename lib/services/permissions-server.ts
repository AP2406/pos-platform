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
  if (st.role_id) {
    const { data: r } = await supabase
      .from("roles")
      .select("permissions")
      .eq("id", st.role_id as string)
      .eq("business_id", businessId)
      .maybeSingle();
    if (r && Array.isArray(r.permissions)) {
      customPermissions = r.permissions as string[];
    }
  }

  const set = resolvePermissions({
    legacyRole: st.role as string,
    customPermissions,
  });
  return {
    staffId: st.id as string,
    name: st.name as string,
    legacyRole: st.role as string,
    can: (perm: PermissionKey) => set.has(perm),
  };
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
