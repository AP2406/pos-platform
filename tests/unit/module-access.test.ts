import { describe, it, expect } from "vitest";
import {
  MODULE_ROUTES,
  canOpenModuleRoute,
  hasModule,
  moduleForRoute,
  requireModule,
} from "@/lib/modules/access";
import { enabledModules } from "@/lib/modules/resolve";
import { buildNav, type NavLink } from "@/lib/modules/nav";
import { BUSINESS_MODES } from "@/lib/modules/modes";

// The sidebar has been mode-aware for a while, but the transportation URLs
// stayed live for everyone: a restaurant owner who typed /app/vehicles got a
// fleet page offering to help them "serve jobs". These tests pin the guard that
// closes that, and pin the thing that made it possible to get wrong — the menu
// and the guard reading from two different lists.

// The rail nests one level, so "everything the sidebar offers" means both.
function flatten(items: NavLink[]): NavLink[] {
  return items.flatMap((i) => [i, ...flatten(i.children ?? [])]);
}

const restaurant = {
  industry: "restaurant",
  config: { modules: ["dashboard", "pos", "orders", "kitchen", "catalog", "customers", "staff", "settings"], mode: "full_service" },
};
const transportation = { industry: "transportation", config: null };

describe("the transportation vertical is invisible to everyone else", () => {
  it("a restaurant cannot open trips, vehicles, drivers or partners", () => {
    for (const href of Object.keys(MODULE_ROUTES)) {
      expect(canOpenModuleRoute(restaurant, href), href).toBe(false);
    }
  });

  it("a transportation business still can", () => {
    for (const href of Object.keys(MODULE_ROUTES)) {
      expect(canOpenModuleRoute(transportation, href), href).toBe(true);
    }
  });

  it("no live business mode reaches them", () => {
    for (const m of BUSINESS_MODES) {
      const ctx = { industry: m.industry, config: { ...m.config, mode: m.key } };
      for (const href of Object.keys(MODULE_ROUTES)) {
        expect(canOpenModuleRoute(ctx, href), m.key + " -> " + href).toBe(false);
      }
    }
  });

  it("detail pages inherit their area's module", () => {
    expect(moduleForRoute("/app/trips/7f3a")).toBe("jobs");
    expect(moduleForRoute("/app/drivers/7f3a/schedule")).toBe("drivers");
    expect(canOpenModuleRoute(restaurant, "/app/trips/7f3a")).toBe(false);
    expect(canOpenModuleRoute(transportation, "/app/drivers/7f3a/schedule")).toBe(true);
  });

  it("does not match on a shared string prefix", () => {
    // /app/tripwire must not inherit /app/trips' module.
    expect(moduleForRoute("/app/tripwire")).toBeNull();
  });

  it("leaves the shared screens alone", () => {
    // Gating these on the preset would take pages away rather than hide another
    // industry's: several modes omit one or another from their stored config
    // while merchants still reach them from settings and the dashboard.
    for (const href of ["/app", "/app/pos", "/app/orders", "/app/catalog", "/app/kitchen", "/app/staff", "/app/reports", "/app/settings"]) {
      expect(moduleForRoute(href), href).toBeNull();
      expect(canOpenModuleRoute(restaurant, href), href).toBe(true);
      expect(canOpenModuleRoute(transportation, href), href).toBe(true);
    }
  });

  it("requireModule renders (does not redirect) when the mode has the module", () => {
    // redirect() throws, so a clean return is the assertion.
    expect(() =>
      requireModule({ industry: "transportation", config: null, drivers_enabled: true }, "/app/trips")
    ).not.toThrow();
  });
});

describe("the driver roster opt-out reaches the guard too", () => {
  const off = { ...transportation, driversEnabled: false };

  it("switching drivers off closes the page, not just the link", () => {
    expect(hasModule(off, "drivers")).toBe(false);
    expect(canOpenModuleRoute(off, "/app/drivers")).toBe(false);
    // The rest of the fleet is untouched.
    expect(canOpenModuleRoute(off, "/app/vehicles")).toBe(true);
  });
});

describe("the sidebar and the module guard agree", () => {
  it("never offers a link the guard would bounce, for any mode", () => {
    const contexts = [
      { industry: "transportation", config: null, hasPos: false },
      { industry: "transportation", config: null, driversEnabled: false, hasPos: false },
      ...BUSINESS_MODES.map((m) => ({
        industry: m.industry,
        config: { ...m.config, mode: m.key },
        floorService: m.key === "full_service",
        hasPos: true,
      })),
    ];
    for (const ctx of contexts) {
      for (const section of buildNav({ ...ctx, role: "owner" })) {
        for (const item of flatten(section.items)) {
          expect(canOpenModuleRoute(ctx, item.href), ctx.industry + " -> " + item.href).toBe(true);
        }
      }
    }
  });
});

describe("modules with no route behind them", () => {
  // leads / calendar / invoices / proposals are catalogued but never built.
  // No preset names them, but a business's config JSONB can, and validateConfig
  // accepts any registry key — which would have put a 404 in that sidebar.
  const configured = {
    industry: "service",
    config: { modules: ["dashboard", "pos", "leads", "calendar", "invoices", "proposals", "settings"] },
  };

  it("are dropped before they can reach the nav", () => {
    expect(enabledModules(configured)).toEqual(["dashboard", "pos", "settings"]);
    const hrefs = buildNav({ ...configured, role: "owner", hasPos: true }).flatMap((s) => flatten(s.items).map((i) => i.href));
    for (const dead of ["/app/leads", "/app/calendar", "/app/invoices", "/app/proposals"]) {
      expect(hrefs, dead).not.toContain(dead);
    }
    expect(hrefs).toContain("/app/pos");
  });
});
