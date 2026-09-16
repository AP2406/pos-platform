// What sold, and for how much — the one aggregate, for every page that asks.
//
// This is /app/reports' product-mix pass, lifted out of the page verbatim so the
// dashboard's "Top-selling items" cannot disagree with the report it links to.
// Writing a second aggregate would have been the cheaper change and a worse one:
// two loops over the same order_items rows, differing in how they key a custom
// line or normalise a split item, is a support ticket that starts "the dashboard
// says 41 and the report says 38".
//
// WHAT THE MONEY HERE IS, EXACTLY. `unit_price × quantity` — the line as it was
// rung. It is NOT net: a check-level discount or comp is not prorated back onto
// the lines that earned it, and a refund does not reduce it (refunding writes to
// `refunds` and flips `orders.status`; it never touches the line). /app/reports
// disclaims this under its own table, and any caller that labels this column
// must say the same thing. Calling it "net sales" would be a straight lie.

import { displayItemName } from "@/lib/format";

/** One `order_items` row, as loosely as PostgREST hands it back. */
export type ItemLine = {
  catalog_item_id?: string | null;
  name?: unknown;
  unit_price?: unknown;
  quantity?: unknown;
};

export type ItemSales = {
  /** `id:<uuid>` for a catalog item, `name:<display name>` for a one-off line. */
  key: string;
  name: string;
  qty: number;
  /** Σ unit_price × quantity. Gross of discounts and refunds — see above. */
  revenue: number;
  /** Null for a Custom (one-off) line, which has no catalog row behind it. */
  catalogItemId: string | null;
};

/**
 * Item sales, biggest earner first.
 *
 * KEYED BY CATALOG ID WHERE THERE IS ONE, by display name where there isn't.
 * Two different one-off "Corkage" lines are the same row; a renamed catalog item
 * stays one row across the rename, which is what an owner scanning a week
 * expects and what keying on the stored name would get wrong.
 *
 * `displayItemName` collapses the split-check suffix, so "Burger (shared)" and
 * "Burger" are one line rather than two half-sized ones — without it a busy
 * Friday of split tables pushes every popular item out of the top four.
 *
 * TIE ORDER IS FIRST-SEEN ORDER, and that is now a guarantee rather than an
 * accident. The original read `Object.keys(itemAgg)` into `.sort()`, which gave
 * insertion order for free because V8 preserves it for string keys and its sort
 * is stable. A Map makes the same promise on purpose, so two items that sold the
 * identical dollar amount do not swap rows between two loads of the same page.
 */
export function aggregateItemSales(lines: ItemLine[]): ItemSales[] {
  const agg = new Map<string, ItemSales>();

  for (const l of lines) {
    const catalogItemId = (l.catalog_item_id as string | null) ?? null;
    const name = displayItemName(String(l.name ?? ""));
    const qty = Number(l.quantity) || 0;
    const revenue = (Number(l.unit_price) || 0) * qty;
    const key = catalogItemId ? "id:" + catalogItemId : "name:" + name;

    const row = agg.get(key);
    if (row) {
      row.qty += qty;
      row.revenue += revenue;
    } else {
      agg.set(key, { key, name, qty, revenue, catalogItemId });
    }
  }

  return [...agg.values()].sort((a, b) => b.revenue - a.revenue);
}
