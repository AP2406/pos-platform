// Authorization for register / KDS server actions.
//
// The admin guard (action-guard.ts) asks "what may this WEB LOGIN do?". That is
// the wrong question at a till: the iPad is signed in once as the venue, and
// individual staff authorize themselves with a 4-6 digit PIN. So the acting
// identity is the staff_members row behind the signed surge_active_staff
// cookie, not business_members.role.
//
// The pattern this replaces was:
//
//     const active = await getActiveStaff();
//     if (active && !(await actorCan(supabase, biz, active.id, "open_drawer"))) {
//       ...require an approver PIN...
//     }
//
// which reads as a permission check but FAILS OPEN: when no one is signed in at
// the PIN pad, `active` is null, the whole branch is skipped, and the mutation
// proceeds unauthorized. That was deliberate — non-staffed tills (quick
// service, retail, transportation) have no PIN session and still need to work —
// but a "use server" function is a public POST endpoint, so it also meant any
// signed-in member could drop the cookie and walk straight past the check.
//
// posAuthorize keeps non-staffed tills working WITHOUT the hole: with no PIN
// session it falls back to the web member role instead of skipping. An owner or
// manager running a counter till is unaffected; a server or bookkeeper posting
// to the endpoint by hand is refused.

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionKey } from "./permissions";
import { canAccess } from "./route-access";
import { staffPermissionsById, type StaffPermissions } from "./permissions-server";
import { ACTIVE_STAFF_COOKIE, readActiveStaffId } from "./active-staff-cookie";

/** Who the system believes performed an action, for audit attribution. */
export type PosActor =
  | { kind: "staff"; staffId: string; name: string; permissions: StaffPermissions }
  | { kind: "member"; staffId: null; name: null; role: string };

export type PosAuthorized = {
  ok: true;
  actor: PosActor;
  /** True when a PIN session identified the actor (so caps/overrides apply). */
  pinned: boolean;
  /**
   * True when the actor lacks the permission themselves and a holder must
   * approve by PIN. The caller decides whether to demand approval or refuse —
   * the existing `needs_approval` flows keep working.
   */
  needsApproval: boolean;
};
export type PosDenied = { ok: false; error: string };
export type PosAuthResult = PosAuthorized | PosDenied;

/** The signed-in cashier, or null. Verifies the cookie signature. */
export async function activeStaffPermissions(
  supabase: SupabaseClient,
  businessId: string
): Promise<StaffPermissions | null> {
  const jar = await cookies();
  const staffId = readActiveStaffId(jar.get(ACTIVE_STAFF_COOKIE)?.value, businessId);
  if (!staffId) return null;
  return staffPermissionsById(supabase, businessId, staffId);
}

/**
 * Resolve and authorize the actor behind a register action.
 *
 * - PIN session present → the staff matrix decides. Lacking the permission is
 *   not fatal: `needsApproval` is set so the caller can ask for an approver PIN,
 *   preserving today's behaviour.
 * - No PIN session → the web member role decides, and lacking the permission IS
 *   fatal. This is the branch that used to be skipped entirely.
 */
export async function posAuthorize(
  supabase: SupabaseClient,
  businessId: string,
  memberRole: string | null | undefined,
  permission: PermissionKey
): Promise<PosAuthResult> {
  const active = await activeStaffPermissions(supabase, businessId);

  if (active) {
    return {
      ok: true,
      pinned: true,
      actor: { kind: "staff", staffId: active.staffId, name: active.name, permissions: active },
      needsApproval: !active.can(permission),
    };
  }

  // Non-staffed till, or a hand-rolled POST with no cookie. Fall back to the
  // web role rather than waving it through.
  if (!canAccess(memberRole, permission)) {
    return { ok: false, error: "Sign in at the PIN pad to do that." };
  }
  return {
    ok: true,
    pinned: false,
    actor: { kind: "member", staffId: null, name: null, role: memberRole ?? "" },
    needsApproval: false,
  };
}
