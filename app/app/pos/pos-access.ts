// app/app/pos/pos-access.ts
// Server-only resolver for the POS actor's effective role + permission gate.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { getActiveStaff } from "./staff-session";
import { can, type AppRole, type Permission } from "@/lib/permissions";

// The effective role for a POS action:
//   - if a cashier is PINned in, their staff role governs
//   - otherwise the logged-in account role governs (solo owner => owner)
export async function posActor(): Promise<{ role: AppRole; staffId: string | null }> {
  const { role } = await requireBusiness();
  const staff = await getActiveStaff();
  if (staff) return { role: staff.role as AppRole, staffId: staff.id };
  return { role: role as AppRole, staffId: null };
}

export async function posCan(perm: Permission): Promise<boolean> {
  const actor = await posActor();
  return can(actor.role, perm);
}

// Verify a manager/owner PIN to approve an action a lower role is blocked from.
// Returns the approver's identity, or null if the PIN is invalid or the holder
// is not a manager/owner.
export async function verifyApproverPin(
  pin: string
): Promise<{ id: string; name: string; role: AppRole } | null> {
  if (!/^[0-9]{4,6}$/.test(pin)) return null;
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: business.id,
    p_pin: pin,
  });
  if (error) {
    console.error("verifyApproverPin:", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const role = row.role as AppRole;
  if (role !== "owner" && role !== "manager") return null;
  return { id: row.id as string, name: row.name as string, role };
}