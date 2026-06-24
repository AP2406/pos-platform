// Granular permission model (Phase A2). Anchored on staff_members (POS PIN
// identities). Backward-compatible: when a business has no custom roles yet (or
// the 0037 migration hasn't been applied), permissions fall back to the DEFAULT
// matrix keyed on the legacy role enum — reproducing today's behavior exactly.

export const PERMISSION_KEYS = [
  "void",
  "comp",
  "discount",
  "refund",
  "reopen_closed_check",
  "edit_price",
  "delete_item_prepay",
  "open_drawer",
  "no_sale",
  "access_reports",
  "export_data",
  "edit_menu",
  "edit_staff",
  "change_tax",
  "close_day",
  "manage_settings",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

// Human labels for the Team settings UI.
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  void: "Void items",
  comp: "Comp (on the house)",
  discount: "Apply discounts",
  refund: "Refunds",
  reopen_closed_check: "Reopen a closed check",
  edit_price: "Edit a price",
  delete_item_prepay: "Delete an item before payment",
  open_drawer: "Open drawer / no-sale",
  no_sale: "No-sale",
  access_reports: "Access reports",
  export_data: "Export data",
  edit_menu: "Edit menu",
  edit_staff: "Edit staff & PINs",
  change_tax: "Change tax",
  close_day: "Close the day",
  manage_settings: "Manage settings & customization",
};

// The 6 default system roles and their permission sets (the matrix approved in
// Phase A planning). These also drive the legacy fallback.
export type SystemRoleKey =
  | "owner"
  | "manager"
  | "shift_lead"
  | "server"
  | "host"
  | "bookkeeper";

const ALL: PermissionKey[] = [...PERMISSION_KEYS];

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "change_tax"),
  shift_lead: [
    "void",
    "comp",
    "discount",
    "delete_item_prepay",
    "open_drawer",
    "no_sale",
    "access_reports",
    "close_day",
  ],
  server: ["delete_item_prepay"],
  host: [],
  bookkeeper: ["access_reports", "export_data"],
};

export const SYSTEM_ROLE_LABELS: Record<SystemRoleKey, string> = {
  owner: "Owner",
  manager: "Manager",
  shift_lead: "Shift-lead",
  server: "Server",
  host: "Host",
  bookkeeper: "Bookkeeper",
};

// Maps the legacy staff_members.role enum to a system role key, so a staff
// member with no custom role_id still resolves to sensible permissions.
export function systemRoleForLegacy(role: string | null | undefined): SystemRoleKey {
  switch (role) {
    case "owner":
      return "owner";
    case "manager":
      return "manager";
    case "trainee":
      return "host";
    case "staff":
    default:
      return "server";
  }
}

// Effective permission set for a staff member. Prefers an explicit custom
// permissions array (from roles.permissions); otherwise derives from the legacy
// enum role via the default matrix.
export function resolvePermissions(input: {
  legacyRole?: string | null;
  customPermissions?: string[] | null;
}): Set<PermissionKey> {
  if (Array.isArray(input.customPermissions)) {
    return new Set(
      input.customPermissions.filter((p): p is PermissionKey =>
        (PERMISSION_KEYS as readonly string[]).includes(p)
      )
    );
  }
  return new Set(DEFAULT_ROLE_PERMISSIONS[systemRoleForLegacy(input.legacyRole)]);
}

export function hasPermission(
  perm: PermissionKey,
  input: { legacyRole?: string | null; customPermissions?: string[] | null }
): boolean {
  return resolvePermissions(input).has(perm);
}
