import { describe, it, expect } from "vitest";
import { computeSplitTotals, type SplitAllocCfg } from "../../app/app/pos/split-alloc";

const baseCfg: SplitAllocCfg = {
  defaultRate: 0.13,
  itemTaxMeta: {},
  rateFracById: {},
  rateNameById: {},
  customerExempt: false,
  scEnabled: false,
  scPct: 0,
  scPostTax: false,
};

// Helper: assert a result reconciles (parts sum to the whole) and return it.
function ok(r: ReturnType<typeof computeSplitTotals>) {
  if ("error" in r) throw new Error("unexpected error: " + r.error);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  expect(sum(r.checkSubtotalCents)).toBe(r.subtotalCents);
  expect(sum(r.discAlloc)).toBe(r.discountCents);
  expect(sum(r.compAlloc)).toBe(r.compCents);
  expect(sum(r.taxAlloc)).toBe(r.taxTotalCents);
  expect(sum(r.scAlloc)).toBe(r.scCents);
  expect(sum(r.perCheckPreTipTotal)).toBe(r.subtotalCents - r.discountCents - r.compCents + r.taxTotalCents + r.scCents);
  return r;
}

describe("computeSplitTotals", () => {
  it("even 2-way split at default rate reconciles", () => {
    const r = ok(computeSplitTotals({
      items: [{ name: "A", unit_price: 10, quantity: 1 }, { name: "B", unit_price: 10, quantity: 1 }],
      checks: [{ lines: [{ name: "A", unit_price: 10, quantity: 1 }] }, { lines: [{ name: "B", unit_price: 10, quantity: 1 }] }],
    }, baseCfg));
    expect(r.perCheckPreTipTotal).toEqual([1130, 1130]); // $10 + 13% each
  });

  it("odd cents split still reconciles to the check total", () => {
    // $10.01 total, split 2 ways -> tax pennies must land somewhere, sum preserved
    const r = ok(computeSplitTotals({
      items: [{ name: "A", unit_price: 3.34, quantity: 1 }, { name: "B", unit_price: 6.67, quantity: 1 }],
      checks: [{ lines: [{ name: "A", unit_price: 3.34, quantity: 1 }] }, { lines: [{ name: "B", unit_price: 6.67, quantity: 1 }] }],
    }, baseCfg));
    // whole tax = round(10.01 * .13) = 1.30 -> 130c; parts sum to 130
    expect(r.taxTotalCents).toBe(130);
  });

  it("multi-tax (GST+PST) split reconciles per rate", () => {
    const cfg: SplitAllocCfg = {
      ...baseCfg,
      defaultRate: 0,
      itemTaxMeta: { x: { taxable: true, tax_rate_ids: ["gst", "pst"] } },
      rateFracById: { gst: 0.05, pst: 0.07 },
      rateNameById: { gst: "GST", pst: "PST" },
    };
    const r = ok(computeSplitTotals({
      items: [{ catalog_item_id: "x", name: "X", unit_price: 10, quantity: 2 }],
      checks: [{ lines: [{ catalog_item_id: "x", name: "X", unit_price: 10, quantity: 1 }] }, { lines: [{ catalog_item_id: "x", name: "X", unit_price: 10, quantity: 1 }] }],
    }, cfg));
    // $20 base -> GST 1.00 + PST 1.40 = 2.40 total tax
    expect(r.taxTotalCents).toBe(240);
    expect(r.perCheckPreTipTotal).toEqual([1120, 1120]); // ($10 + $0.50 + $0.70) each
  });

  it("whole-check discount is allocated and reconciles", () => {
    const r = ok(computeSplitTotals({
      items: [{ name: "A", unit_price: 10, quantity: 1 }, { name: "B", unit_price: 30, quantity: 1 }],
      checks: [{ lines: [{ name: "A", unit_price: 10, quantity: 1 }] }, { lines: [{ name: "B", unit_price: 30, quantity: 1 }] }],
      discount_type: "amount",
      discount_value: 4,
    }, baseCfg));
    expect(r.discountCents).toBe(400);
    // discount weighted by subtotal: $1 to seat A ($10/$40), $3 to seat B
    expect(r.discAlloc).toEqual([100, 300]);
  });

  it("tax-exempt zeroes tax", () => {
    const r = ok(computeSplitTotals({
      items: [{ name: "A", unit_price: 10, quantity: 1 }, { name: "B", unit_price: 10, quantity: 1 }],
      checks: [{ lines: [{ name: "A", unit_price: 10, quantity: 1 }] }, { lines: [{ name: "B", unit_price: 10, quantity: 1 }] }],
      tax_exempt: true,
    }, baseCfg));
    expect(r.taxTotalCents).toBe(0);
    expect(r.perCheckPreTipTotal).toEqual([1000, 1000]);
  });

  it("rejects an allocation that doesn't cover every item", () => {
    const r = computeSplitTotals({
      items: [{ name: "A", unit_price: 10, quantity: 1 }, { name: "B", unit_price: 10, quantity: 1 }],
      checks: [{ lines: [{ name: "A", unit_price: 10, quantity: 1 }] }, { lines: [] }],
    }, baseCfg);
    expect("error" in r).toBe(true);
  });
});
