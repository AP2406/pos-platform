import { describe, it, expect } from "vitest";
import { buildDeliverectMenu, mapStatus, deliverectReady, DELIVERECT_STATUS, getDeliverectConfig, sendDeliverectStatus, pushDeliverectMenu } from "../../lib/services/deliverect";

// Deliverect provider: pure mappers + the CREDS BOUNDARY (everything outbound
// no-ops until a merchant token is connected). Money-independent throughout.

// Minimal chainable supabase mock (same approach as the ticket-append test).
function mockSb(tables: Record<string, unknown>) {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      in: () => b,
      maybeSingle: () => Promise.resolve({ data: (tables[table] as { one?: unknown } | undefined)?.one ?? null }),
      then: (res: (v: { data: unknown }) => unknown) => Promise.resolve({ data: (tables[table] as { many?: unknown } | undefined)?.many ?? [] }).then(res),
    });
    return b;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (t: string) => builder(t) } as any;
}

describe("status mapping", () => {
  it("maps our fulfillment ops to Deliverect codes", () => {
    expect(mapStatus("accept")).toBe(DELIVERECT_STATUS.ACCEPTED);
    expect(mapStatus("preparing")).toBe(DELIVERECT_STATUS.PREPARING);
    expect(mapStatus("ready")).toBe(DELIVERECT_STATUS.READY);
    expect(mapStatus("cancel")).toBe(DELIVERECT_STATUS.CANCELED);
  });
});

describe("buildDeliverectMenu", () => {
  it("maps the catalog to products + categories, dollars → cents, 86 → snoozed", () => {
    const payload = buildDeliverectMenu("loc-1", [
      { id: "a", name: "Burger", price: 12.5, category: "Mains", outOfStock: false },
      { id: "b", name: "Fries", price: 5, category: "Sides", outOfStock: true },
      { id: "c", name: "Cola", price: 3, category: null },
    ]);
    expect(payload.locationId).toBe("loc-1");
    expect(payload.products).toHaveLength(3);
    expect(payload.products[0]).toMatchObject({ plu: "a", name: "Burger", price: 1250, category: "Mains", snoozed: false });
    expect(payload.products[1].snoozed).toBe(true); // 86'd
    expect(payload.products[2].category).toBe("Menu"); // null category → default
    const cats = payload.categories.map((c) => c.name).sort();
    expect(cats).toEqual(["Mains", "Menu", "Sides"]);
    expect(payload.categories.find((c) => c.name === "Mains")?.products).toEqual(["a"]);
  });
});

describe("creds boundary", () => {
  it("deliverectReady requires an active connection AND a token", () => {
    expect(deliverectReady({ locationId: "l", token: "t", active: true })).toBe(true);
    expect(deliverectReady({ locationId: "l", token: null, active: true })).toBe(false);
    expect(deliverectReady({ locationId: "l", token: "t", active: false })).toBe(false);
  });

  it("config falls back to the legacy settings location id when no integration row", async () => {
    const sb = mockSb({ business_integrations: { one: null }, businesses: { one: { settings: { deliverect_location_id: "legacy-loc" } } } });
    const cfg = await getDeliverectConfig(sb, "biz");
    expect(cfg.locationId).toBe("legacy-loc");
    expect(cfg.token).toBeNull();
    expect(deliverectReady(cfg)).toBe(false);
  });

  it("sending status NO-OPS (never throws) when Deliverect isn't connected", async () => {
    const sb = mockSb({ business_integrations: { one: null }, businesses: { one: { settings: {} } } });
    const res = await sendDeliverectStatus(sb, "biz", "DLV-1", "ready");
    expect(res.sent).toBe(false);
    expect(res.skipped).toBe("deliverect not connected");
  });

  it("menu push NO-OPS when not connected", async () => {
    const sb = mockSb({ business_integrations: { one: null }, businesses: { one: { settings: {} } } });
    const res = await pushDeliverectMenu(sb, "biz");
    expect(res).toMatchObject({ pushed: false, count: 0, skipped: "deliverect not connected" });
  });

  it("skips sending with no external order id", async () => {
    const sb = mockSb({});
    expect(await sendDeliverectStatus(sb, "biz", "", "accept")).toMatchObject({ sent: false, skipped: "no external order id" });
  });
});
