// Who can open which admin route.
//
// Before this module, every page in app/app/** repeated the same line:
//
//     if (role !== "owner" && role !== "manager") redirect("/app");
//
// That is a *role* check, not a *permission* check, and it had two costs:
// a bookkeeper with `export_data` still couldn't open the export page, and the
// answer to "what can a shift lead see?" was spread over 42 files. Route access
// now resolves through the same 16-key matrix the POS uses
// (lib/services/permissions.ts), keyed on the web login's member role.
//
// COMPATIBILITY IS THE POINT: WEB_ROLE_PERMISSIONS is seeded so that owner,
// manager, staff and trainee keep exactly the access they have today. Only the
// two roles added in migration 0099 (shift_lead, bookkeeper) gain anything,
// because previously they could not sign in at all.

import { redirect } from "next/navigation";
import type { PermissionKey } from "./permissions";
import { PERMISSION_KEYS } from "./permissions";

export type WebRole =
  | "owner"
  | "manager"
  | "staff"
  | "trainee"
  | "shift_lead"
  | "bookkeeper";

const ALL: PermissionKey[] = [...PERMISSION_KEYS];

/**
 * Permissions granted to a *web dashboard* session by member role. These mirror
 * DEFAULT_ROLE_PERMISSIONS exactly — the web and the register agree on what a
 * role can do.
 *
 * `staff` and `trainee` are the legacy web roles; they map to the matrix's
 * `server` and `host`. Note they do NOT hold access_reports, and they don't
 * need it: /app/reports has never had a guard and isn't in ROUTE_PERMISSIONS,
 * so it stays open to every member exactly as it is today. Granting it here
 * would have quietly handed staff the accounting pages too.
 */
export const WEB_ROLE_PERMISSIONS: Record<WebRole, PermissionKey[]> = {
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
  bookkeeper: ["access_reports", "export_data"],
  staff: ["delete_item_prepay"],
  trainee: [],
};

export const WEB_ROLE_LABELS: Record<WebRole, string> = {
  owner: "Owner",
  manager: "Manager",
  shift_lead: "Shift lead",
  bookkeeper: "Bookkeeper",
  staff: "Staff",
  trainee: "Trainee",
};

/** Roles an owner/manager may assign from the members UI (never "owner"). */
export const ASSIGNABLE_WEB_ROLES: WebRole[] = [
  "manager",
  "shift_lead",
  "bookkeeper",
  "staff",
  "trainee",
];

export const WEB_ROLE_HINTS: Record<WebRole, string> = {
  owner: "Everything, including tax settings.",
  manager: "Runs the restaurant day to day. Everything except tax settings.",
  shift_lead: "Approves voids and comps on shift, reads reports, closes the day.",
  bookkeeper: "Books and exports only — no menu, staff or settings access.",
  staff: "Service screens and reports.",
  trainee: "Read-only service screens.",
};

/**
 * The `roles.key` a web member role corresponds to.
 *
 * Distinct from systemRoleForLegacy(), which maps the *staff* enum
 * (staff_members.role) and is still the right call for a PIN identity with no
 * role_id. This one maps a business_members role, where the names already match
 * except for the two legacy values.
 */
export function roleKeyForWebRole(role: string | null | undefined): string {
  switch (role) {
    case "staff":
      return "server";
    case "trainee":
      return "host";
    case "owner":
    case "manager":
    case "shift_lead":
    case "bookkeeper":
      return role;
    default:
      return "server"; // unknown → least privilege
  }
}

export function webPermissions(role: string | null | undefined): Set<PermissionKey> {
  const list = WEB_ROLE_PERMISSIONS[(role ?? "") as WebRole];
  // Unknown role → no elevated access (fail closed), matching the old guards.
  return new Set(list ?? []);
}

/** Does this web session hold a permission? */
export function canAccess(
  role: string | null | undefined,
  perm: PermissionKey
): boolean {
  return webPermissions(role).has(perm);
}

/**
 * Guard for a server component: redirects instead of rendering when the role
 * lacks the permission. Replaces the hand-rolled `if (role !== ...) redirect()`.
 */
export function requirePermission(
  role: string | null | undefined,
  perm: PermissionKey,
  fallback = "/app"
): void {
  if (!canAccess(role, perm)) redirect(fallback);
}

/**
 * Permission required to OPEN a given admin route, longest-prefix wins.
 *
 * This table mirrors the hard guards in the page files exactly — if a page
 * redirects, it's listed here; if it renders for everyone and merely disables
 * its write controls (inventory, purchasing, recipes, waste, locations,
 * exports), it is deliberately absent, because hiding those links would take
 * away read access staff have today.
 *
 * The sidebar filters on this, so a role is never shown a link that would
 * bounce it, and a test can assert the whole surface at once.
 */
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  // Money & books
  "/app/accounting": "access_reports",
  "/app/insights": "access_reports",
  "/app/tips": "access_reports",
  "/app/labor": "access_reports",
  "/app/customers/insights": "access_reports",
  // Service oversight
  "/app/approvals": "void",
  "/app/exceptions": "void",
  "/app/incidents": "void",
  "/app/log": "void",
  "/app/live-ops": "void",
  // People
  "/app/schedule": "edit_staff",
  "/app/attendance": "edit_staff",
  "/app/staff": "edit_staff",
  "/app/staff-records": "edit_staff",
  "/app/broadcasts": "edit_staff",
  // Menu
  "/app/catalog/push": "edit_menu",
  "/app/pricing": "edit_menu",
  "/app/upsells": "edit_menu",
  // Growth & config
  "/app/marketing": "manage_settings",
  "/app/integrations": "manage_settings",
  "/app/audit": "manage_settings",
  "/app/floor/qr-codes": "manage_settings",
};

/** The permission a route needs, or null when it's open to every member. */
export function permissionForRoute(href: string): PermissionKey | null {
  let best: { len: number; perm: PermissionKey } | null = null;
  for (const [prefix, perm] of Object.entries(ROUTE_PERMISSIONS)) {
    if (href === prefix || href.startsWith(prefix + "/")) {
      if (!best || prefix.length > best.len) best = { len: prefix.length, perm };
    }
  }
  return best ? best.perm : null;
}

/** Can this role open this route at all? Drives sidebar filtering. */
export function canOpenRoute(role: string | null | undefined, href: string): boolean {
  const perm = permissionForRoute(href);
  return perm == null ? true : canAccess(role, perm);
}
