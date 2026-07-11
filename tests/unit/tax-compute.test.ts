import { describe, it, expect } from "vitest";
import { computeCartTax, itemTaxBuckets, type CartTaxConfig } from "../../lib/services/tax-compute";

// GST 5% + PST 7% stacked, plus a default-rate fallback, exercised through the one
// shared helper every money path uses (register preview, close, split, guest pay).
const cfg: CartTaxConfig = {
  defaultRateFrac: 0.13,
  itemTaxMeta: {
    gstpst: { taxable: true, tax_rate_ids: ["gst", "pst"] },
    gstonly: { taxable: true, tax_rate_ids: ["gst"] },
    exempt: { taxable: false, tax_rate_ids: ["gst"] },
    nowin: { taxable: true, tax_rate_ids: [] }, // taxable but no specific rate -> default
  },
  rateFracById: { gst: 0.05, pst: 0.07 },
  rateNameById: { gst: "GST", pst: "PST" },
};

describe("computeCartTax — multi-tax stacking", () => {
  it("stacks two taxes on one item, one breakdown line per rate", () => {
    const r = computeCartTax([{ catalog_item_id: "gstpst", unit_price: 10, quantity: 1 }], cfg, 1);
    expect(r.tax).toBe(1.2); // 0.50 GST + 0.70 PST
    const byLabel = Object.fromEntries(r.taxBreakdown.map((b) => [b.label, b.amount]));
    expect(byLabel).toEqual({ GST: 0.5, PST: 0.7 });
  });

  it("single-rate item is unchanged (backward compatible)", () => {
    const r = computeCartTax([{ catalog_item_id: "gstonly", unit_price: 20, quantity: 1 }], cfg, 1);
    expect(r.tax).toBe(1.0);
    expect(r.taxBreakdown).toHaveLength(1);
  });

  it("taxable item with no specific rate uses the default", () => {
    const r = computeCartTax([{ catalog_item_id: "nowin", unit_price: 10, quantity: 1 }], cfg, 1);
    expect(r.tax).toBe(1.3);
  });

  it("a custom line (no catalog_item_id) uses the default rate", () => {
    const r = computeCartTax([{ catalog_item_id: null, unit_price: 10, quantity: 1 }], cfg, 1);
    expect(r.tax).toBe(1.3);
  });

  it("non-taxable item is excluded even if it lists rates", () => {
    const r = computeCartTax([{ catalog_item_id: "exempt", unit_price: 10, quantity: 1 }], cfg, 1);
    expect(r.tax).toBe(0);
    expect(r.taxBreakdown).toHaveLength(0);
  });

  it("accumulates the same rate across items into one bucket", () => {
    const r = computeCartTax(
      [
        { catalog_item_id: "gstpst", unit_price: 10, quantity: 1 },
        { catalog_item_id: "gstonly", unit_price: 10, quantity: 1 },
      ],
      cfg,
      1
    );
    // GST base = 20 -> 1.00 ; PST base = 10 -> 0.70
    const byLabel = Object.fromEntries(r.taxBreakdown.map((b) => [b.label, b.amount]));
    expect(byLabel.GST).toBe(1.0);
    expect(byLabel.PST).toBe(0.7);
    expect(r.tax).toBe(1.7);
  });

  it("itemTaxBuckets returns one bucket per applicable rate", () => {
    expect(itemTaxBuckets(cfg.itemTaxMeta.gstpst, cfg).map((b) => b.label)).toEqual(["GST", "PST"]);
    expect(itemTaxBuckets(cfg.itemTaxMeta.exempt, cfg)).toHaveLength(0);
    expect(itemTaxBuckets(undefined, cfg).map((b) => b.frac)).toEqual([0.13]);
  });
});
