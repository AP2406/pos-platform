import { describe, it, expect } from "vitest";
import { mapDeliverectOrder } from "../../lib/services/delivery";

// Guards the Deliverect webhook adapter: cents→dollars, field mapping, and that
// an unmappable payload is rejected. Field names are Deliverect's documented
// channel-order shape (verify against a real sandbox order before go-live).
describe("mapDeliverectOrder", () => {
  it("maps a channel order to the normalized shape (cents → dollars)", () => {
    const n = mapDeliverectOrder({
      channelOrderId: "DLV-123",
      channelOrderDisplayId: "#42",
      location: "loc-abc",
      items: [
        { name: "Burger", quantity: 2, price: 1299, remark: "no onion" },
        { name: "Fries", quantity: 1, price: 499 },
      ],
      productsTotal: 3097,
      taxTotal: 402,
      orderTotal: 3499,
    });
    expect(n).not.toBeNull();
    expect(n!.external_id).toBe("DLV-123");
    expect(n!.display_id).toBe("#42");
    expect(n!.location_ref).toBe("loc-abc");
    expect(n!.items).toHaveLength(2);
    expect(n!.items[0]).toMatchObject({ name: "Burger", quantity: 2, unit_price: 12.99, note: "no onion" });
    expect(n!.subtotal).toBe(30.97);
    expect(n!.tax).toBe(4.02);
    expect(n!.total).toBe(34.99);
  });

  it("falls back to payment.amount for the total and _id for the external id", () => {
    const n = mapDeliverectOrder({ _id: "abc", items: [{ name: "X", quantity: 1, price: 100 }], payment: { amount: 100 } });
    expect(n!.external_id).toBe("abc");
    expect(n!.total).toBe(1);
  });

  it("returns null with no order id / non-object", () => {
    expect(mapDeliverectOrder({ items: [] })).toBeNull();
    expect(mapDeliverectOrder(null)).toBeNull();
  });
});
