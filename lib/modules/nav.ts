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
// Now every destination is declared here, in a group, with the permission it
// requires. The sidebar renders sections; a role only ever sees links it can
// actually open (permissions come from lib/services/route-access.ts, the same
// source the page guards use, so the menu and the guard can't disagree).

import type { PermissionKey } from "@/lib/services/permissions";
import { canOpenRoute } from "@/lib/services/route-access";
import { enabledModules, getPreset } from "./resolve";
import { MODULES, type ModuleKey } from "./registry";
import { resolveLabel } from "./resolve";

export type NavGroupKey = "service" | "money" | "team" | "stock" | "guests" | "config";

export type NavLink = {
  href: string;
  label: string;
  /** Present only for routes that aren't in every mode's core module list. */
  permission?: PermissionKey;
};

export type NavSection = { key: NavGroupKey; label: string; items: NavLink[] };

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

// Group headings are mode-specific: a limo dispatcher and a restaurant manager
// should not both be reading "Service".
const GROUP_LABELS: Record<string, Record<NavGroupKey, string>> = {
  restaurant: {
    service: "Service",
    money: "Sales & money",
    team: "Team",
    stock: "Menu & inventory",
    guests: "Guests & marketing",
    config: "Settings",
  },
  retail: {
    service: "Front of store",
    money: "Sales & money",
    team: "Team",
    stock: "Products & stock",
    guests: "Customers & marketing",
    config: "Settings",
  },
  transportation: {
    service: "Dispatch",
    money: "Sales & money",
    team: "Drivers & fleet",
    stock: "Services",
    guests: "Customers & partners",
    config: "Settings",
  },
  service: {
    service: "Today",
    money: "Sales & money",
    team: "Team",
    stock: "Services",
    guests: "Clients & marketing",
    config: "Settings",
  },
  mobile_seller: {
    service: "Selling",
    money: "Sales & money",
    team: "Team",
    stock: "Items",
    guests: "Customers",
    config: "Settings",
  },
};

const DEFAULT_GROUP_LABELS = GROUP_LABELS.restaurant;

// Which group each core module belongs to.
const MODULE_GROUP: Record<ModuleKey, NavGroupKey> = {
  dashboard: "service",
  pos: "service",
  orders: "service",
  kitchen: "service",
  jobs: "service",
  calendar: "service",
  leads: "guests",
  profit: "money",
  invoices: "money",
  proposals: "money",
  catalog: "stock",
  vehicles: "team",
  drivers: "team",
  staff: "team",
  customers: "guests",
  partners: "guests",
  settings: "config",
};

export function groupLabels(industry?: string | null): Record<NavGroupKey, string> {
  return (industry && GROUP_LABELS[industry]) || DEFAULT_GROUP_LABELS;
}

/**
 * The full sidebar for a business + viewer, grouped and permission-filtered.
 * Empty groups are dropped, so a bookkeeper sees two short sections rather than
 * six headings with nothing under them.
 */
export function buildNav(ctx: NavBuildContext): NavSection[] {
  const preset = getPreset({ industry: ctx.industry, config: ctx.config });
  const floor = ctx.floorService === true;
  const pos = ctx.hasPos !== false;

  const buckets: Record<NavGroupKey, NavLink[]> = {
    service: [],
    money: [],
    team: [],
    stock: [],
    guests: [],
    config: [],
  };

  // 1. Core modules for this mode, in preset order. enabledModules() is the
  //    same list lib/modules/access.ts guards the pages with, so a mode's menu
  //    and its live URLs describe the same product. Permission-filtered on top
  //    of that — /app/staff is a core module but its page redirects anyone
  //    without edit_staff, so showing it to a server was a dead link.
  for (const key of enabledModules(ctx)) {
    const def = MODULES[key];
    if (!def) continue;
    if (!canOpenRoute(ctx.role, def.href)) continue;
    buckets[MODULE_GROUP[key] ?? "service"].push({
      href: def.href,
      label: resolveLabel(def, preset),
    });
  }

  // 2. POS-dependent screens. `add` keeps declaration terse and skips anything
  //    the viewer's role can't open.
  const add = (group: NavGroupKey, href: string, label: string, when = true) => {
    if (!when) return;
    if (!canOpenRoute(ctx.role, href)) return;
    if (buckets[group].some((i) => i.href === href)) return;
    buckets[group].push({ href, label });
  };

  if (pos) {
    // Service
    add("service", "/app/live-ops", "Live ops", floor);
    add("service", "/app/reservations", "Reservations", floor);
    add("service", "/app/clock", "Time clock", floor);
    add("service", "/app/checklists", "Checklists", floor);

    // Sales & money
    add("money", "/app/reports", "Reports");
    add("money", "/app/accounting", "Accounting", floor);
    add("money", "/app/exports", "Exports");
    add("money", "/app/tips", "Tips", floor);
    add("money", "/app/approvals", "Approvals", floor);
    add("money", "/app/exceptions", "Exceptions", floor);
    add("money", "/app/locations", "All locations", ctx.multiLocation === true);

    // Team
    add("team", "/app/schedule", "Schedule", floor);
    add("team", "/app/labor", "Labor", floor);
    add("team", "/app/attendance", "Attendance", floor);
    add("team", "/app/staff-records", "Staff records", floor);
    add("team", "/app/log", "Shift log", floor);
    add("team", "/app/incidents", "Incidents", floor);
    add("team", "/app/broadcasts", "Announcements", floor);

    // Menu & inventory
    add("stock", "/app/inventory", "Inventory");
    add("stock", "/app/purchasing", "Purchasing");
    add("stock", "/app/recipes", "Recipes", floor);
    add("stock", "/app/waste", "Waste", floor);
    add("stock", "/app/pricing", "Happy hour", floor);
    add("stock", "/app/upsells", "Upsells", floor);

    // Guests & marketing
    add("guests", "/app/insights", "Insights", floor);
    add("guests", "/app/marketing", "Marketing");

    // Settings
    add("config", "/app/integrations", "Integrations", floor);
    add("config", "/app/audit", "Activity log");
  }

  const labels = groupLabels(ctx.industry);
  const order: NavGroupKey[] = ["service", "money", "team", "stock", "guests", "config"];
  return order
    .map((key) => ({ key, label: labels[key], items: buckets[key] }))
    .filter((s) => s.items.length > 0);
}
