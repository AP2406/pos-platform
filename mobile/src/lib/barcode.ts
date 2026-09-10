// Pure barcode matching for scan-to-add. No I/O — takes the loaded catalog and a
// scanned code, returns the matching item. Money-independent (order shaping).

export type Barcoded = { barcode: string | null };

// Trim + drop leading zeros for a forgiving numeric compare. UPC-A (12) and
// EAN-13 (13) differ by a leading zero for the same product, and cameras/wedge
// scanners vary on whether they include it — so "012345678905" and "12345678905"
// should match the same item.
export function normalizeCode(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return /^\d+$/.test(t) ? t.replace(/^0+/, "") || "0" : t;
}

// Build a lookup keyed by normalized code (first item wins on a dup).
export function barcodeIndex<T extends Barcoded>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const it of items) {
    const key = normalizeCode(it.barcode);
    if (key && !map.has(key)) map.set(key, it);
  }
  return map;
}

export function matchBarcode<T extends Barcoded>(index: Map<string, T>, code: string): T | null {
  const key = normalizeCode(code);
  if (!key) return null;
  return index.get(key) ?? null;
}
