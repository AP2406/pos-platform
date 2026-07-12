import type { SupabaseClient } from "@supabase/supabase-js";
import { staffPermissionsById } from "./permissions-server";
import type { PermissionKey } from "./permissions";

// P0 security: server-side verification of manager approval for in-sale sensitive
// actions (discount, comp, line void, tax exemption, service-charge waive). The
// register gates these client-side, but the server must NOT trust a client-supplied
// approver — a modified client could forge one. This re-derives the cashier's own
// authority (role permissions + caps) and, for anything the cashier can't do,
// requires a manager PIN that is RE-VERIFIED here against the required permission.
//
// Used by both createOrder and finalizeSplitCheck so the two order-creation paths
// enforce identically.

// permKey null ⇒ a manager-role action (tax exemption / SC waive have no permission
// key; the register gates them on manager role — mirror that here).
export type SensitiveAction = { present: boolean; label: string; permKey: PermissionKey | null; amount: number | null };

export type ApprovalGateResult = { approver: { id: string; name: string } | null } | { blocked: string[] };

export async function verifyInSaleApprovals(opts: {
  supabase: SupabaseClient;
  businessId: string;
  isStaffed: boolean; // a cashier is signed in (staffed till)
  isTraining: boolean;
  cashierId: string | null;
  cashierRole: string | null;
  approverPin: string | undefined;
  actions: SensitiveAction[];
}): Promise<ApprovalGateResult> {
  const { supabase, businessId, isStaffed, isTraining, cashierId, cashierRole, approverPin, actions } = opts;
  // Unstaffed tills (QSR/retail with no PIN system) and training practice are exempt,
  // matching the register's own gate.
  if (!isStaffed || isTraining) return { approver: null };

  const cashierPerms = cashierId ? await staffPermissionsById(supabase, businessId, cashierId) : null;

  let approverRow: { id: string; name: string; role: string; perms: NonNullable<Awaited<ReturnType<typeof staffPermissionsById>>> } | null = null;
  if (approverPin && /^[0-9]{4,6}$/.test(approverPin)) {
    const { data } = await supabase.rpc("verify_staff_member_pin", { p_business_id: businessId, p_pin: approverPin });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      const perms = await staffPermissionsById(supabase, businessId, row.id as string);
      if (perms) approverRow = { id: row.id as string, name: row.name as string, role: row.role as string, perms };
    }
  }

  const capFor = (permKey: PermissionKey | null): number | null =>
    permKey === "discount" ? cashierPerms?.discountCap ?? null : permKey === "comp" ? cashierPerms?.compCap ?? null : null;

  let approver: { id: string; name: string } | null = null;
  const blocked: string[] = [];
  for (const a of actions) {
    if (!a.present) continue;
    const cap = capFor(a.permKey);
    const cashierOk =
      a.permKey === null
        ? cashierRole === "manager"
        : !!cashierPerms && cashierPerms.can(a.permKey) && !(cap != null && a.amount != null && a.amount > cap);
    if (cashierOk) continue;
    const approverOk = !!approverRow && (a.permKey === null ? approverRow.role === "manager" : approverRow.perms.can(a.permKey));
    if (approverOk && approverRow) {
      approver = { id: approverRow.id, name: approverRow.name };
      continue;
    }
    blocked.push(a.label);
  }
  return blocked.length > 0 ? { blocked } : { approver };
}
