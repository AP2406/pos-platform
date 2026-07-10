import { describe, it, expect } from "vitest";
import { forwardOrderFields, CANONICAL_ORDER_KEYS, type CanonicalOrderInput } from "../../lib/pos/canonical-order";

// STEP 2: every tender (cash, split, manual card, tap-to-pay, terminal) forwards
// the SAME canonical payload to createOrder. This guards the payment paths from
// silently dropping a field again (the bug where card/terminal lost comp /
// service-charge / voids and could reverse a charge after the customer paid).

const FULL: CanonicalOrderInput = {
  items: [{ catalog_item_id: "c1", name: "Burger", unit_price: 12, quantity: 2, taxable: true, seat: 1 }],
  voids: [{ name: "Fries", unit_price: 4, quantity: 1, reason_code: "server_error" }],
  tip: 3,
  discount_type: "percent",
  discount_value: 10,
  discount_reason_code: "manager",
  discount_reason_note: "loyal regular",
  comp_value: 5,
  comp_reason_code: "service_recovery",
  comp_reason_note: "late food",
  service_charge: true,
  service_charge_auto: true,
  service_charge_waive_reason_code: "n/a",
  service_charge_waive_reason_note: "",
  tax_exempt: true,
  tax_exempt_reason_code: "reseller",
  tax_exempt_reason_note: "cert 123",
  customer_id: "cust-1",
  idempotency_key: "idem-1",
  dining_option: "dine_in",
  open_ticket_id: "11111111-1111-1111-1111-111111111111",
  signature_data: "data:image/png;base64,AAA",
  approver: { id: "mgr-1", name: "Sam" },
};

describe("canonical order payload", () => {
  it("forwards every canonical field — nothing dropped", () => {
    const out = forwardOrderFields(FULL);
    for (const key of CANONICAL_ORDER_KEYS) {
      expect(out).toHaveProperty(key);
      expect(out[key]).toEqual(FULL[key]);
    }
  });

  it("preserves item-level extras (taxable, seat, …) that ride along", () => {
    const out = forwardOrderFields(FULL);
    expect(out.items[0]).toMatchObject({ taxable: true, seat: 1 });
  });

  it("CANONICAL_ORDER_KEYS matches the forwarded key set exactly", () => {
    const forwardedKeys = Object.keys(forwardOrderFields(FULL)).sort();
    expect(forwardedKeys).toEqual([...CANONICAL_ORDER_KEYS].sort());
  });
});
