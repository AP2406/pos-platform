// Shared display formatters. View-layer only — these never alter stored data,
// they just humanize machine values consistently across every screen.

/**
 * Item name for display/aggregation. "Shared" is metadata from split checks, not
 * part of the product — strip the "(shared)" suffix so "Fries" and
 * "Fries (shared)" collapse to one product everywhere.
 */
export function displayItemName(name: string | null | undefined): string {
  return (name ?? "").replace(/\s*\(shared\)\s*$/i, "").trim() || "Item";
}

/** True when an item name carries the split "(shared)" marker. */
export function isSharedItem(name: string | null | undefined): boolean {
  return /\(shared\)\s*$/i.test(name ?? "");
}

/**
 * Payment method enum → human label. cash→Cash, card→Card,
 * store_credit→Store credit, gift_card→Gift card, split→Split, and any card
 * network / Finix value → Card. Unknown values are humanized (underscores out).
 */
export function formatPaymentMethod(method: string | null | undefined): string {
  const m = (method ?? "").trim().toLowerCase();
  if (!m) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    store_credit: "Store credit",
    house_account: "House account",
    gift_card: "Gift card",
    split: "Split",
    other: "Other",
  };
  if (map[m]) return map[m];
  if (/finix|visa|mastercard|amex|american_express|discover|interac|debit|credit|network/.test(m)) {
    return "Card";
  }
  return m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, " ");
}

/**
 * Elapsed minutes → compact duration. <60m → "Xm", <24h → "Xh" / "Xh Ym",
 * else "Xd" / "Xd Yh". Zero second-units are dropped for cleanliness.
 */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  if (m < 60) return m + "m";
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? h + "h " + r + "m" : h + "h";
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h > 0 ? d + "d " + h + "h" : d + "d";
}
