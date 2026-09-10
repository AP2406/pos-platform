// lib/modules/access.ts
// Does this business's mode include the module a route belongs to?
//
// The sidebar has been mode-aware for a while: buildNav() only emits the
// modules in a business's preset, so a restaurant's menu has never contained
// Trips or Drivers. The URLs stayed live, though. /app/vehicles rendered
// happily for a pizzeria and invited the owner to "add the vehicles you use to
// serve jobs" — a hidden link is not a gate, and anyone who bookmarked,
// guessed, or followed a stale link landed in another vertical's product.
//
// This is the module twin of lib/services/route-access.ts, and it is shaped the
// same on purpose: a longest-prefix route table plus a canOpen/require pair.
// Both guards resolve through enabledModules(), the same list the sidebar is
// built from, so the menu and the page can never disagree.

import { redirect } from "next/navigation";
import type { ModuleKey } from "./registry";
import { enabledModules, type ModuleContext } from "./resolve";

export type { ModuleContext };

/** The business row shape a page already has in hand from requireBusiness(). */
export type ModuleBusiness = {
  industry?: string | null;
  config?: unknown;
  drivers_enabled?: boolean | null;
};

/**
 * Route prefix → the module that owns it.
 *
 * Only the vertical-specific areas are listed, because those are the ones where
 * "not in the preset" genuinely means "this business is not in that line of
 * work". The shared screens (POS, orders, catalog, kitchen, staff, reports…)
 * are deliberately absent: several live modes leave one or another out of their
 * stored config yet merchants still reach them from links in settings and on
 * the dashboard, so gating those on the preset would take away working pages
 * rather than hide someone else's industry.
 */
export const MODULE_ROUTES: Record<string, ModuleKey> = {
  "/app/trips": "jobs",
  "/app/vehicles": "vehicles",
  "/app/drivers": "drivers",
  "/app/partners": "partners",
};

/** The module a route belongs to, longest prefix wins, or null when shared. */
export function moduleForRoute(href: string): ModuleKey | null {
  let best: { len: number; key: ModuleKey } | null = null;
  for (const [prefix, key] of Object.entries(MODULE_ROUTES)) {
    if (href === prefix || href.startsWith(prefix + "/")) {
      if (!best || prefix.length > best.len) best = { len: prefix.length, key };
    }
  }
  return best ? best.key : null;
}

export function hasModule(ctx: ModuleContext, key: ModuleKey): boolean {
  return enabledModules(ctx).includes(key);
}

/** Can a business in this mode open this route at all? */
export function canOpenModuleRoute(ctx: ModuleContext, href: string): boolean {
  const key = moduleForRoute(href);
  return key == null ? true : hasModule(ctx, key);
}

/**
 * Guard for a server component: redirects instead of rendering when the
 * business's mode doesn't include the route's module. Mirrors
 * requirePermission() from lib/services/route-access.ts, which answers the
 * other half of "may this request see this page" — who you are, versus what
 * kind of business this is. Both land on /app, which every mode has.
 */
export function requireModule(
  business: ModuleBusiness | null | undefined,
  href: string,
  fallback = "/app"
): void {
  const ctx: ModuleContext = {
    industry: business?.industry,
    config: business?.config,
    driversEnabled: business?.drivers_enabled,
  };
  if (!canOpenModuleRoute(ctx, href)) redirect(fallback);
}
