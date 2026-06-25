// Shared, pure cart-tax computation. Extracted verbatim from the register's close
// path (app/app/pos/actions.ts) so the QR pay-at-table guest path (GAP-1 chunk 3)
// produces a byte-identical, server-authoritative tax/total — no duplicated money
// logic. No I/O: callers supply the per-item tax metadata + rate maps.

export type TaxItem = { catalog_item_id?: string | null; unit_price: number; quantity: number };

export type CartTaxConfig = {
  defaultRateFrac: number; // normalized fraction (e.g. 0.13), applied when an item has no specific rate
  itemTaxMeta: Record<string, { taxable: boolean; tax_rate_id: string | null }>;
  rateFracById: Record<string, number>; // tax_rate_id -> fraction
  rateNameById: Record<string, string>; // tax_rate_id -> label
};

export type CartTaxResult = {
  tax: number;
  taxableBase: number;
  taxBreakdown: { label: string; rate: number; base: number; amount: number }[];
};

// taxF prorates each taxable item's base for any whole-order discount/comp
// (netSubtotal / subtotal). Pass 1 when there is no discount/comp (guest pay).
export function computeCartTax(items: TaxItem[], cfg: CartTaxConfig, taxF: number): CartTaxResult {
  const rateBuckets: Record<string, { label: string; frac: number; base: number }> = {};
  for (const i of items) {
    const meta = i.catalog_item_id ? cfg.itemTaxMeta[i.catalog_item_id] : undefined;
    const isTaxable = meta ? meta.taxable : true;
    if (!isTaxable) continue;
    let frac = cfg.defaultRateFrac;
    let label = "Tax";
    if (meta && meta.tax_rate_id && cfg.rateFracById[meta.tax_rate_id] !== undefined) {
      frac = cfg.rateFracById[meta.tax_rate_id];
      label = cfg.rateNameById[meta.tax_rate_id] || "Tax";
    }
    if (frac <= 0) continue;
    const key = label + "@" + frac.toFixed(6);
    if (!rateBuckets[key]) rateBuckets[key] = { label: label, frac: frac, base: 0 };
    rateBuckets[key].base += i.unit_price * i.quantity;
  }

  let tax = 0;
  let taxableBase = 0;
  const taxBreakdown: { label: string; rate: number; base: number; amount: number }[] = [];
  for (const key of Object.keys(rateBuckets)) {
    const b = rateBuckets[key];
    const discountedBase = Math.round(b.base * taxF * 100) / 100;
    const amount = Math.round(discountedBase * b.frac * 100) / 100;
    tax += amount;
    taxableBase += discountedBase;
    taxBreakdown.push({ label: b.label, rate: b.frac, base: discountedBase, amount: amount });
  }
  return {
    tax: Math.round(tax * 100) / 100,
    taxableBase: Math.round(taxableBase * 100) / 100,
    taxBreakdown,
  };
}
