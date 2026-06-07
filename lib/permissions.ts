// lib/permissions.ts
// Single source of truth for who can do what in Surge.
// Pure module (no imports) so it is safe to use on both client and server:
//   - client components use can(role, perm) to show/hide/disable controls
//   - server actions enforce the same matrix as the real gate
//
// Two role systems map onto AppRole:
//   - business_members.role (the logged-in account): owner | manager | staff | trainee
//   - staff_members.role  (the PIN cashier at the register):       manager | staff | trainee

export type AppRole = "owner" | "manager" | "staff" | "trainee";

export type Permission =
  | "sale.discount"
  | "sale.discount_over_threshold"
  | "sale.void"
  | "sale.refund"
  | "sale.tax_exempt"
  | "day.open_close"
  | "staff.manage";

// Discounts above this share of the (pre-discount) subtotal require a
// manager/owner PIN to approve. Expressed as a percent, e.g. 15 = 15%.
export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 15;

export const ALL_PERMISSIONS: Permission[] = [
  "sale.discount",
  "sale.discount_over_threshold",
  "sale.void",
  "sale.refund",
  "sale.tax_exempt",
  "day.open_close",
  "staff.manage",
];

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: ALL_PERMISSIONS.slice(),
  manager: ALL_PERMISSIONS.slice(),
  staff: ["sale.discount", "day.open_close"],
  trainee: [],
};

export function can(role: AppRole | string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const list = ROLE_PERMISSIONS[role as AppRole];
  if (!list) return false;
  return list.indexOf(perm) !== -1;
}

// A manager or owner can approve actions a lower role is blocked from
// (e.g. an over-threshold discount). Staff and trainees cannot approve.
export function canApprove(role: AppRole | string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

// True when a discount needs manager approval for the given role.
// discountAmount and subtotal are in the same unit (dollars or cents).
export function discountNeedsApproval(
  role: AppRole | string | null | undefined,
  discountAmount: number,
  subtotal: number
): boolean {
  if (discountAmount <= 0) return false;
  if (can(role, "sale.discount_over_threshold")) return false;
  if (!can(role, "sale.discount")) return true;
  if (subtotal <= 0) return false;
  const pct = (discountAmount / subtotal) * 100;
  return pct > DISCOUNT_APPROVAL_THRESHOLD_PCT;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  trainee: "Trainee",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "sale.discount": "Apply a discount",
  "sale.discount_over_threshold": "Discount over threshold (no approval)",
  "sale.void": "Void a sale",
  "sale.refund": "Issue a refund",
  "sale.tax_exempt": "Mark a sale tax-exempt",
  "day.open_close": "Start / end the day",
  "staff.manage": "Manage staff & settings",
};