// Pure per-check split allocation — extracted verbatim from finalizeSplitCheck so
// quoteSplitCheck (preview) and finalizeSplitCheck (settle) share ONE money math.
// No I/O: the caller supplies the tax metadata + business config. Integer-cents
// with largest-remainder allocation; every component's parts sum to the whole.
import { allocateWeighted } from "./split-math";
import { itemTaxBuckets, type ItemTaxMeta } from "@/lib/services/tax-compute";

export type SplitAllocItem = { catalog_item_id?: string | null; name: string; unit_price: number; quantity: number; taxable?: boolean };

export type SplitAllocInput = {
  items: SplitAllocItem[];
  checks: { lines: SplitAllocItem[]; tip?: number }[];
  discount_type?: "amount" | "percent";
  discount_value?: number;
  comp_value?: number;
  tax_exempt?: boolean;
  service_charge?: boolean;
};

export type SplitAllocCfg = {
  defaultRate: number; // fraction, e.g. 0.13
  itemTaxMeta: Record<string, ItemTaxMeta>;
  rateFracById: Record<string, number>;
  rateNameById: Record<string, string>;
  customerExempt: boolean;
  scEnabled: boolean;
  scPct: number; // 0..100
  scPostTax: boolean;
};

export type SplitAllocResult = {
  subtotalCents: number;
  discountCents: number;
  compCents: number;
  taxTotalCents: number;
  scCents: number;
  checkSubtotalCents: number[];
  discAlloc: number[];
  compAlloc: number[];
  taxAlloc: number[];
  scAlloc: number[];
  perCheckPreTipTotal: number[]; // cents, EXCLUDES tip
  // dollar values for the order snapshot
  discount: number;
  comp: number;
  tax: number;
  serviceCharge: number;
  netSubtotal: number;
  isExempt: boolean;
  scApplied: boolean;
};

const c = (dollars: number) => Math.round(dollars * 100);

export function computeSplitTotals(data: SplitAllocInput, cfg: SplitAllocCfg): SplitAllocResult | { error: string } {
  const taxCfg = { defaultRateFrac: cfg.defaultRate, rateFracById: cfg.rateFracById, rateNameById: cfg.rateNameById };
  const bucketsOf = (it: SplitAllocItem): { key: string; label: string; frac: number }[] => {
    if (it.catalog_item_id) return itemTaxBuckets(cfg.itemTaxMeta[it.catalog_item_id], taxCfg);
    if (it.taxable === false || cfg.defaultRate <= 0) return [];
    return [{ key: "Tax@" + cfg.defaultRate.toFixed(6), label: "Tax", frac: cfg.defaultRate }];
  };

  const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const subtotalCents = c(subtotal);
  if (subtotalCents <= 0) return { error: "Nothing to split." };

  const discountType = data.discount_type ?? "amount";
  const discountValue = data.discount_value ?? 0;
  let discount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  let comp = data.comp_value ?? 0;
  if (comp < 0) comp = 0;
  if (comp > discountedSubtotal) comp = discountedSubtotal;
  comp = Math.round(comp * 100) / 100;

  const netSubtotal = Math.round((discountedSubtotal - comp) * 100) / 100;
  const taxF = subtotal > 0 ? netSubtotal / subtotal : 0;

  // whole-check tax buckets (one per rate; multi-tax stacks)
  const wholeBuckets: Record<string, { label: string; frac: number; base: number }> = {};
  for (const it of data.items) {
    for (const b of bucketsOf(it)) {
      if (!wholeBuckets[b.key]) wholeBuckets[b.key] = { label: b.label, frac: b.frac, base: 0 };
      wholeBuckets[b.key].base += it.unit_price * it.quantity;
    }
  }
  const bucketTaxCents: Record<string, number> = {};
  let tax = 0;
  for (const key of Object.keys(wholeBuckets)) {
    const b = wholeBuckets[key];
    const discountedBase = Math.round(b.base * taxF * 100) / 100;
    const amt = Math.round(discountedBase * b.frac * 100) / 100;
    bucketTaxCents[key] = c(amt);
    tax += amt;
  }
  tax = Math.round(tax * 100) / 100;

  const isExempt = data.tax_exempt === true || cfg.customerExempt;
  if (isExempt) {
    for (const key of Object.keys(bucketTaxCents)) bucketTaxCents[key] = 0;
    tax = 0;
  }

  let scPct = cfg.scPct;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scApplied = cfg.scEnabled && scPct > 0 && data.service_charge === true;
  const scBase = scApplied ? (cfg.scPostTax ? Math.round((netSubtotal + tax) * 100) / 100 : netSubtotal) : 0;
  const serviceCharge = scApplied ? Math.round(scBase * (scPct / 100) * 100) / 100 : 0;

  const discountCents = c(discount);
  const compCents = c(comp);
  const scCents = c(serviceCharge);

  // --- partition: per-check item subtotal + per-bucket base ---
  const N = data.checks.length;
  const checkSubtotalCents: number[] = [];
  const checkBucketBaseCents: Record<string, number[]> = {};
  for (const key of Object.keys(wholeBuckets)) checkBucketBaseCents[key] = new Array(N).fill(0);
  for (let ci = 0; ci < N; ci++) {
    let s = 0;
    for (const ln of data.checks[ci].lines) {
      s += c(ln.unit_price * ln.quantity);
      for (const b of bucketsOf(ln)) {
        if (checkBucketBaseCents[b.key]) checkBucketBaseCents[b.key][ci] += c(ln.unit_price * ln.quantity);
      }
    }
    checkSubtotalCents.push(s);
  }
  const partitionSum = checkSubtotalCents.reduce((a, b) => a + b, 0);
  if (partitionSum !== subtotalCents) return { error: "Split doesn't add up to the check. Assign every item exactly once." };
  for (let ci = 0; ci < N; ci++) if (checkSubtotalCents[ci] <= 0) return { error: "Every sub-check needs at least one item." };

  // --- allocate each component across checks (exact, largest-remainder) ---
  const discAlloc = allocateWeighted(discountCents, checkSubtotalCents);
  const compAlloc = allocateWeighted(compCents, checkSubtotalCents);
  const scAlloc = allocateWeighted(scCents, checkSubtotalCents);
  const taxAlloc = new Array<number>(N).fill(0);
  let taxTotalCents = 0;
  for (const key of Object.keys(bucketTaxCents)) {
    taxTotalCents += bucketTaxCents[key];
    const shares = allocateWeighted(bucketTaxCents[key], checkBucketBaseCents[key]);
    for (let ci = 0; ci < N; ci++) taxAlloc[ci] += shares[ci];
  }

  // --- conservation invariant: parts must sum to the original, to the cent ---
  const grandTotalCents = subtotalCents - discountCents - compCents + taxTotalCents + scCents;
  const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const perCheckPreTipTotal = checkSubtotalCents.map((s, ci) => s - discAlloc[ci] - compAlloc[ci] + taxAlloc[ci] + scAlloc[ci]);
  if (
    sumOf(checkSubtotalCents) !== subtotalCents ||
    sumOf(discAlloc) !== discountCents ||
    sumOf(compAlloc) !== compCents ||
    sumOf(taxAlloc) !== taxTotalCents ||
    sumOf(scAlloc) !== scCents ||
    sumOf(perCheckPreTipTotal) !== grandTotalCents
  ) {
    return { error: "Split failed to reconcile to the check total. No payment was taken." };
  }

  return {
    subtotalCents, discountCents, compCents, taxTotalCents, scCents,
    checkSubtotalCents, discAlloc, compAlloc, taxAlloc, scAlloc, perCheckPreTipTotal,
    discount, comp, tax, serviceCharge, netSubtotal, isExempt, scApplied,
  };
}
