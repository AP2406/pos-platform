import { describe, it, expect } from "vitest";
import { fireDeliveryOrderToKitchen, deliveryTicketLabel } from "../../lib/services/delivery-kitchen";

// Fires an ingested (pre-paid) delivery order to the KDS. The gap this closes:
// inject_delivery_order recorded the paid order but never created a kitchen_ticket,
// so channel orders never reached the Kitchen Display. Money-independent.

function mockSb(catalog: unknown[], opts: { insertError?: unknown } = {}) {
  const calls: { insert?: Record<string, unknown>[] } = {};
  const builder = () => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      in: () => b,
      insert: (rows: Record<string, unknown>[]) => {
        calls.insert = rows;
        return Promise.resolve({ error: opts.insertError ?? null });
      },
      then: (res: (v: { data: unknown }) => unknown) => Promise.resolve({ data: catalog }).then(res),
    });
    return b;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { sb: { from: () => builder() } as any, calls };
}

const args = (over = {}) => ({
  businessId: "biz",
  platform: "deliverect",
  displayId: "#42",
  externalId: "DLV-123",
  items: [
    { name: "Burger", quantity: 2, note: "no onion" },
    { name: "Fries", quantity: 1, note: null },
  ],
  ...over,
});

describe("deliveryTicketLabel", () => {
  it("labels the KDS card by platform + channel order number", () => {
    expect(deliveryTicketLabel("deliverect", "#42")).toBe("Deliverect #42");
    expect(deliveryTicketLabel("ubereats", "#7")).toBe("Uber Eats #7");
    expect(deliveryTicketLabel("deliverect", null, "DLV-999888")).toBe("Deliverect #999888");
  });
});

describe("fireDeliveryOrderToKitchen", () => {
  it("station-splits by matching item names to the catalog", async () => {
    const { sb, calls } = mockSb([
      { name: "Burger", station_id: "grill", allergens: ["gluten"] },
      { name: "Fries", station_id: "fryer", allergens: [] },
    ]);
    const res = await fireDeliveryOrderToKitchen(sb, args());
    expect(res).toEqual({ fired: 3, tickets: 2 }); // 2 burgers + 1 fries, 2 stations
    const rows = calls.insert!;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.element_id === null)).toBe(true); // no table
    expect(rows.every((r) => r.label === "Deliverect #42")).toBe(true); // one KDS card
    const grill = rows.find((r) => r.station_id === "grill")!;
    expect((grill.items as Record<string, unknown>[])[0]).toMatchObject({ name: "Burger", quantity: 2, note: "no onion", allergens: ["gluten"] });
  });

  it("falls back to a single no-station ticket when names don't match the catalog", async () => {
    const { sb, calls } = mockSb([]);
    const res = await fireDeliveryOrderToKitchen(sb, args());
    expect(res).toEqual({ fired: 3, tickets: 1 });
    expect(calls.insert![0].station_id).toBeNull();
  });

  it("rejects an empty order and surfaces insert failures", async () => {
    const { sb } = mockSb([]);
    expect(await fireDeliveryOrderToKitchen(sb, args({ items: [] }))).toHaveProperty("error");
    const { sb: bad } = mockSb([], { insertError: { message: "boom" } });
    expect(await fireDeliveryOrderToKitchen(bad, args())).toHaveProperty("error");
  });
});
