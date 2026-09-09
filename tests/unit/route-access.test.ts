import { describe, it, expect } from "vitest";
import {
  canAccess,
  canOpenRoute,
  permissionForRoute,
  WEB_ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
} from "@/lib/services/route-access";
import { buildNav } from "@/lib/modules/nav";

// Admin route access used to be 42 copies of
// `role !== "owner" && role !== "manager"`. These tests pin the replacement:
// the roles that could reach a page before must still reach it, the two roles
// added in migration 0099 must reach exactly what their matrix entry allows,
// and the sidebar must never offer a link the guard would bounce.

const restaurant = {
  industry: "restaurant",
  config: { mode: "full_service" },
  floorService: true,
  hasPos: true,
};

function navHrefs(role: string, extra: Record<string, unknown> = {}): string[] {
  return buildNav({ ...restaurant, role, ...extra }).flatMap((s) =>
    s.items.map((i) => i.href)
  );
}

describe("no regression for the roles that already existed", () => {
  it("owner keeps everything", () => {
    for (const href of Object.keys(ROUTE_PERMISSIONS)) {
      expect(canOpenRoute("owner", href), href).toBe(true);
    }
  });

  it("manager keeps everything except tax settings", () => {
    for (const href of Object.keys(ROUTE_PERMISSIONS)) {
      expect(canOpenRoute("manager", href), href).toBe(true);
    }
    expect(canAccess("manager", "change_tax")).toBe(false);
    expect(canAccess("owner", "change_tax")).toBe(true);
  });

  it("staff and trainee are still shut out of the admin pages", () => {
    for (const role of ["staff", "trainee"]) {
      expect(canOpenRoute(role, "/app/accounting")).toBe(false);
      expect(canOpenRoute(role, "/app/schedule")).toBe(false);
      expect(canOpenRoute(role, "/app/approvals")).toBe(false);
      expect(canOpenRoute(role, "/app/audit")).toBe(false);
    }
  });

  it("staff keep Reports, which has always been in their sidebar", () => {
    // Reports is an OPEN route — no page guard, no ROUTE_PERMISSIONS entry — so
    // staff reach it without holding access_reports. Granting them that
    // permission instead would also have opened /app/accounting to them.
    expect(permissionForRoute("/app/reports")).toBeNull();
    expect(canAccess("staff", "access_reports")).toBe(false);
    expect(canOpenRoute("staff", "/app/reports")).toBe(true);
    expect(navHrefs("staff")).toContain("/app/reports");
  });

  it("an unknown or missing role gets nothing (fails closed)", () => {
    expect(canOpenRoute(null, "/app/accounting")).toBe(false);
    expect(canOpenRoute(undefined, "/app/accounting")).toBe(false);
    expect(canOpenRoute("chief-vibes-officer", "/app/accounting")).toBe(false);
  });
});

describe("the roles the enum migration unlocked", () => {
  it("bookkeeper can open the books and exports, nothing else", () => {
    expect(canOpenRoute("bookkeeper", "/app/accounting")).toBe(true);
    expect(canOpenRoute("bookkeeper", "/app/accounting/payroll")).toBe(true);
    expect(canAccess("bookkeeper", "export_data")).toBe(true);

    expect(canOpenRoute("bookkeeper", "/app/schedule")).toBe(false);
    expect(canOpenRoute("bookkeeper", "/app/staff")).toBe(false);
    expect(canOpenRoute("bookkeeper", "/app/pricing")).toBe(false);
    expect(canOpenRoute("bookkeeper", "/app/marketing")).toBe(false);
    expect(canOpenRoute("bookkeeper", "/app/approvals")).toBe(false);
  });

  it("shift lead gets reports and floor oversight, not settings or payroll admin", () => {
    expect(canOpenRoute("shift_lead", "/app/approvals")).toBe(true);
    expect(canOpenRoute("shift_lead", "/app/exceptions")).toBe(true);
    expect(canOpenRoute("shift_lead", "/app/log")).toBe(true);
    expect(canOpenRoute("shift_lead", "/app/accounting")).toBe(true);

    expect(canOpenRoute("shift_lead", "/app/staff")).toBe(false);
    expect(canOpenRoute("shift_lead", "/app/marketing")).toBe(false);
    expect(canOpenRoute("shift_lead", "/app/integrations")).toBe(false);
    expect(canAccess("shift_lead", "export_data")).toBe(false);
  });
});

describe("route prefix matching", () => {
  it("nested routes inherit their parent's permission", () => {
    expect(permissionForRoute("/app/accounting/year-end")).toBe("access_reports");
    expect(permissionForRoute("/app/accounting/consolidated")).toBe("access_reports");
  });

  it("longest prefix wins, so a child can be stricter than its parent", () => {
    // /app/catalog is open to everyone; /app/catalog/push is not.
    expect(permissionForRoute("/app/catalog")).toBeNull();
    expect(permissionForRoute("/app/catalog/push")).toBe("edit_menu");
    expect(canOpenRoute("staff", "/app/catalog")).toBe(true);
    expect(canOpenRoute("staff", "/app/catalog/push")).toBe(false);
  });

  it("does not match on a shared string prefix", () => {
    // /app/logistics must not inherit /app/log's permission.
    expect(permissionForRoute("/app/logistics")).toBeNull();
  });

  it("unlisted routes are open to any signed-in member", () => {
    expect(permissionForRoute("/app")).toBeNull();
    expect(permissionForRoute("/app/pos")).toBeNull();
    expect(permissionForRoute("/app/clock")).toBeNull();
  });
});

describe("the sidebar and the guards agree", () => {
  it("never shows a link the role would be bounced from", () => {
    for (const role of Object.keys(WEB_ROLE_PERMISSIONS)) {
      for (const href of navHrefs(role)) {
        expect(canOpenRoute(role, href), role + " -> " + href).toBe(true);
      }
    }
  });

  it("surfaces the routes that used to be reachable only by typing the URL", () => {
    const owner = navHrefs("owner");
    for (const href of [
      "/app/live-ops",
      "/app/inventory",
      "/app/purchasing",
      "/app/recipes",
      "/app/waste",
      "/app/exports",
    ]) {
      expect(owner, href).toContain(href);
    }
  });

  it("groups every item and drops empty groups", () => {
    const sections = buildNav({ ...restaurant, role: "bookkeeper" });
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.items.length).toBeGreaterThan(0);
    }
    // A bookkeeper has no business in the team or marketing sections.
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/app/schedule");
    expect(hrefs).not.toContain("/app/marketing");
  });

  it("only offers the locations roll-up to multi-location accounts", () => {
    expect(navHrefs("owner", { multiLocation: false })).not.toContain("/app/locations");
    expect(navHrefs("owner", { multiLocation: true })).toContain("/app/locations");
  });

  it("hides floor-only screens from a quick-service restaurant", () => {
    const qsr = navHrefs("owner", { config: { mode: "quick_service" }, floorService: false });
    expect(qsr).not.toContain("/app/reservations");
    expect(qsr).not.toContain("/app/tips");
    expect(qsr).toContain("/app/reports");
  });

  it("calls the orders hub Orders, not Tickets or Tabs", () => {
    for (const mode of ["full_service", "bar", "quick_service"]) {
      const sections = buildNav({
        ...restaurant,
        config: { mode },
        role: "owner",
      });
      const orders = sections
        .flatMap((s) => s.items)
        .find((i) => i.href === "/app/orders");
      if (orders) expect(orders.label, mode).toBe("Orders");
    }
  });
});
