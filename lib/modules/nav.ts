// The admin sidebar, assembled in one place.
//
// Before this, the sidebar was two things stapled together: ~9 module links
// from resolveNav(), plus ~20 links hardcoded in app/app/layout.tsx behind
// nested `if (role === "owner" || role === "manager")` blocks. The result was a
// flat 29-item list with no grouping, and about a dozen built routes
// (live-ops, inventory, purchasing, recipes, waste, locations, exports,
// customer insights, menu push, go-live, QR codes) that existed in the app but
// appeared in no menu — reachable only if you knew the URL.
//
// Declaring everything here fixed reachability and broke density: grouping 36
// destinations under six headings still renders 36 rows, and the category norm
// (docs/competitor-dashboard-study.md §1.2) is 10–16 visible items — Square
// ships 10 flat, Lightspeed 16 in three groups. We were running roughly 2.5×
// the widest competitor on every admin screen.
//
// SO THE SHAPE CHANGED, NOT THE SURFACE. Every destination that was here is
// still here, and still permission-filtered by exactly the same rule. What
// changed is that the long tail now hangs off the primary it belongs to —
// Lightspeed's pattern, where `Reports ›` expands its children inline — so the
// rail opens at 8 rows for a full-service owner instead of 36, and the
// eight-or-so rows under the branch you are working in are one click away.
//
// TWO INVARIANTS, both load-bearing:
//
//   1. Nothing becomes unreachable. A secondary link only nests when its parent
//      survived the same mode + permission filtering it did; when the parent is
//      absent (wrong vertical, or the viewer can't open it) the child is
//      PROMOTED to the top level rather than dropped. /app/staff is the case
//      that forces this: it needs `edit_staff`, so a shift lead who can open
//      /app/log but not /app/staff gets Shift log at the top level.
//   2. Permissions still come from lib/services/route-access.ts, the same
//      source the page guards use, so the menu and the guard can't disagree.

import type { PermissionKey } from "@/lib/services/permissions";
import { canOpenRoute } from "@/lib/services/route-access";
import { enabledModules, getPreset } from "./resolve";
import { MODULES } from "./registry";
import { resolveLabel } from "./resolve";

export type NavLink = {
  href: string;
  label: string;
  /** Present only for routes that aren't in every mode's core module list. */
  permission?: PermissionKey;
  /**
   * Secondary destinations that fold under this one. Exactly one level deep —
   * TouchBistro's three-level accordion is on the study's "do not copy" list
   * (§3.7) and the rail has to stay scannable, not become a file tree.
   */
  children?: NavLink[];
};

export type NavSection = { key: string; label: string; items: NavLink[] };

export type NavBuildContext = {
  industry?: string | null;
  config?: unknown;
  driversEnabled?: boolean;
  /** True for full-service restaurants (floor plan, coursing, tips). */
  floorService?: boolean;
  /** Business has a POS module at all. */
  hasPos?: boolean;
  role?: string | null;
  /** More than one business on this account — unlocks the roll-up. */
  multiLocation?: boolean;
};

/**
 * Which primary each secondary destination folds under.
 *
 * The parent is always a real page in its own right, never a bare disclosure
 * header, so clicking it does something and there is no "expand to find out
 * what this is" step. Every value here is a href that never appears as a KEY —
 * the nesting is deliberately one level and this map is where that is enforced.
 */
const PARENT: Record<string, string> = {
  // Running service today.
  "/app/kitchen": "/app/orders",
  "/app/live-ops": "/app/orders",
  "/app/reservations": "/app/orders",
  "/app/checklists": "/app/orders",
  // Approvals and exceptions are the manager's service-oversight queue — both
  // gate on `void`, the same permission live-ops does, not on anything to do
  // with the books.
  "/app/approvals": "/app/orders",
  "/app/exceptions": "/app/orders",

  // What you sell, and what it costs you.
  "/app/inventory": "/app/catalog",
  "/app/purchasing": "/app/catalog",
  "/app/recipes": "/app/catalog",
  "/app/waste": "/app/catalog",
  "/app/pricing": "/app/catalog",
  "/app/upsells": "/app/catalog",

  // Reading the numbers.
  "/app/profit": "/app/reports",
  "/app/accounting": "/app/reports",
  "/app/tips": "/app/reports",
  "/app/exports": "/app/reports",
  "/app/locations": "/app/reports",

  // People.
  "/app/schedule": "/app/staff",
  "/app/clock": "/app/staff",
  "/app/attendance": "/app/staff",
  "/app/labor": "/app/staff",
  "/app/staff-records": "/app/staff",
  "/app/log": "/app/staff",
  "/app/incidents": "/app/staff",
  "/app/broadcasts": "/app/staff",
  // Transportation's fleet: the roster is the primary, the vehicles hang off
  // it. drivers_enabled=false removes the roster, and vehicles is promoted.
  "/app/vehicles": "/app/drivers",

  // Who you sell to.
  "/app/partners": "/app/customers",
  "/app/insights": "/app/customers",
  "/app/marketing": "/app/customers",

  // Configuring the thing.
  "/app/integrations": "/app/settings",
  "/app/audit": "/app/settings",
};

/**
 * Top-level order. Lists secondaries too, because any of them can be promoted
 * when its parent is filtered out, and a promoted link should land where it
 * would have sat rather than at the bottom of the rail.
 */
const NAV_ORDER: string[] = [
  "/app",
  "/app/pos",
  "/app/orders",
  "/app/kitchen",
  "/app/live-ops",
  "/app/reservations",
  "/app/checklists",
  "/app/approvals",
  "/app/exceptions",
  "/app/trips",
  "/app/catalog",
  "/app/inventory",
  "/app/purchasing",
  "/app/recipes",
  "/app/waste",
  "/app/pricing",
  "/app/upsells",
  "/app/reports",
  "/app/profit",
  "/app/accounting",
  "/app/tips",
  "/app/exports",
  "/app/locations",
  "/app/staff",
  "/app/schedule",
  "/app/clock",
  "/app/attendance",
  "/app/labor",
  "/app/staff-records",
  "/app/log",
  "/app/incidents",
  "/app/broadcasts",
  "/app/drivers",
  "/app/vehicles",
  "/app/customers",
  "/app/partners",
  "/app/insights",
  "/app/marketing",
  "/app/settings",
  "/app/integrations",
  "/app/audit",
];

const RANK: Record<string, number> = Object.fromEntries(
  NAV_ORDER.map((href, i) => [href, i])
);
// An href nobody ordered sorts immediately before Settings — never after it,
// because "the settings drawer is last" is the one position in a sidebar that
// every product in the category agrees on.
const UNRANKED = RANK["/app/settings"] - 0.5;

/**
 * The full sidebar for a business + viewer: a short primary rail, with each
 * primary's own screens folded underneath it.
 */
export function buildNav(ctx: NavBuildContext): NavSection[] {
  const preset = getPreset({ industry: ctx.industry, config: ctx.config });
  const floor = ctx.floorService === true;
  const pos = ctx.hasPos !== false;

  // One flat pass first — same filtering as before, same order of declaration —
  // and the folding happens afterwards, so which list a route is declared in
  // has no bearing on where it ends up in the tree.
  const flat: NavLink[] = [];
  const seen = new Set<string>();
  const push = (href: string, label: string, when = true) => {
    if (!when) return;
    if (seen.has(href)) return;
    // /app/staff is a core module but its page redirects anyone without
    // edit_staff, so showing it to a server was a dead link.
    if (!canOpenRoute(ctx.role, href)) return;
    seen.add(href);
    flat.push({ href, label });
  };

  // 1. Core modules for this mode, in preset order. enabledModules() is the
  //    same list lib/modules/access.ts guards the pages with, so a mode's menu
  //    and its live URLs describe the same product.
  for (const key of enabledModules(ctx)) {
    const def = MODULES[key];
    if (!def) continue;
    push(def.href, resolveLabel(def, preset));
  }

  // 2. POS-dependent screens, declared under the primary they belong to so the
  //    child order in the rail is the order they are written in here.
  if (pos) {
    // Orders
    push("/app/live-ops", "Live ops", floor);
    push("/app/reservations", "Reservations", floor);
    push("/app/checklists", "Checklists", floor);
    push("/app/approvals", "Approvals", floor);
    push("/app/exceptions", "Exceptions", floor);

    // Menu / products
    push("/app/inventory", "Inventory");
    push("/app/purchasing", "Purchasing");
    push("/app/recipes", "Recipes", floor);
    push("/app/waste", "Waste", floor);
    push("/app/pricing", "Happy hour", floor);
    push("/app/upsells", "Upsells", floor);

    // Reports
    push("/app/reports", "Reports");
    push("/app/accounting", "Accounting", floor);
    push("/app/tips", "Tips", floor);
    push("/app/exports", "Exports");
    push("/app/locations", "All locations", ctx.multiLocation === true);

    // Team
    push("/app/schedule", "Schedule", floor);
    push("/app/clock", "Time clock", floor);
    push("/app/attendance", "Attendance", floor);
    push("/app/labor", "Labor", floor);
    push("/app/staff-records", "Staff records", floor);
    push("/app/log", "Shift log", floor);
    push("/app/incidents", "Incidents", floor);
    push("/app/broadcasts", "Announcements", floor);

    // Customers
    push("/app/insights", "Insights", floor);
    push("/app/marketing", "Marketing");

    // Settings
    push("/app/integrations", "Integrations", floor);
    push("/app/audit", "Activity log");
  }

  // 3. Fold. A link nests only when its declared parent survived the same
  //    filtering; otherwise it is promoted, which is the whole reachability
  //    guarantee in one line.
  const byHref = new Map(flat.map((l) => [l.href, l]));
  const top: NavLink[] = [];
  for (const link of flat) {
    const parentHref = PARENT[link.href];
    // `PARENT[parentHref] == null` keeps the tree exactly one level deep even
    // if someone later adds a chain to the map by mistake.
    const parent =
      parentHref && PARENT[parentHref] == null ? byHref.get(parentHref) : undefined;
    if (parent) {
      (parent.children ??= []).push(link);
    } else {
      top.push(link);
    }
  }

  top.sort((a, b) => (RANK[a.href] ?? UNRANKED) - (RANK[b.href] ?? UNRANKED));

  // One section. Six headings over six one-to-eight-item groups was the other
  // half of the density problem: the headings themselves were 6 more rows of
  // ink, and with 8 primaries there is nothing left to group. The section
  // wrapper survives because the sidebar, the role editor and the tests all
  // speak it, and a future mode may want to split the rail again.
  return top.length > 0 ? [{ key: "primary", label: "Main", items: top }] : [];
}
