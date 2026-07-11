// Shared, pure cart-tax computation. Extracted verbatim from the register's close
// path (app/app/pos/actions.ts) so the QR pay-at-table guest path (GAP-1 chunk 3)
// produces a byte-identical, server-authoritative tax/total — no duplicated money
// logic. No I/O: callers supply the per-item tax metadata + rate maps.

export type TaxItem = { catalog_item_id?: string | null; unit_price: number; quantity: number };

// An item can carry several taxes (multi-tax stacking, e.g. GST + PST). Empty
// tax_rate_ids + taxable = the business default rate.
export type ItemTaxMeta = { taxable: boolean; tax_rate_ids: string[] };

export type CartTaxConfig = {
  defaultRateFrac: number; // normalized fraction (e.g. 0.13), applied when an item has no specific rate
  itemTaxMeta: Record<string, ItemTaxMeta>;
  rateFracById: Record<string, number>; // tax_rate_id -> fraction
  rateNameById: Record<string, string>; // tax_rate_id -> label
};

// The tax buckets a single item contributes to. One bucket per applicable rate
// (multi-tax), or one default bucket, or none when non-taxable / no positive rate.
// Bucket identity is label@frac so identical rates across items accumulate together
// and per-bucket rounding matches every call site (register, close, split, guest).
export function itemTaxBuckets(
  meta: ItemTaxMeta | undefined,
  cfg: Pick<CartTaxConfig, "defaultRateFrac" | "rateFracById" | "rateNameById">
): { key: string; label: string; frac: number }[] {
  const isTaxable = meta ? meta.taxable : true;
  if (!isTaxable) return [];
  const ids = meta && meta.tax_rate_ids.length > 0 ? meta.tax_rate_ids : null;
  if (!ids) {
    const frac = cfg.defaultRateFrac;
    return frac > 0 ? [{ key: "Tax@" + frac.toFixed(6), label: "Tax", frac }] : [];
  }
  const out: { key: string; label: string; frac: number }[] = [];
  for (const id of ids) {
    const frac = cfg.rateFracById[id];
    if (frac === undefined || frac <= 0) continue;
    const label = cfg.rateNameById[id] || "Tax";
    out.push({ key: label + "@" + frac.toFixed(6), label, frac });
  }
  return out;
}

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
    for (const b of itemTaxBuckets(meta, cfg)) {
      if (!rateBuckets[b.key]) rateBuckets[b.key] = { label: b.label, frac: b.frac, base: 0 };
      rateBuckets[b.key].base += i.unit_price * i.quantity;
    }
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
