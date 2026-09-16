// How an order reached us — the one definition, for every page that asks.
//
// This lived inside app/app/reports/page.tsx, where it was correct and where
// only one page could see it. The dashboard now needs the same split, and a
// second copy would have been a second answer: the two screens would have
// agreed on the day they were written and drifted the first time either one was
// touched. So it moved here and reports imports it. Nothing about the
// classification changed in the move.
//
// TWO FIELDS, AND NEITHER IS ENOUGH ON ITS OWN:
//
//   orders.channel          plain text, no enum, no CHECK. Written only by the
//                           non-register paths — 'kiosk' (0071), 'online'
//                           (0072/0096), 'qr' (0073), and
//                           'doordash'|'ubereats'|'grubhub'|'delivery' (0074).
//                           NULL on anything rung at a till.
//
//   snapshot.dining_option  JSONB ONLY. There has never been a dining_option
//                           column, and selecting it as one errors the whole
//                           PostgREST query — that is what broke the Orders hub
//                           (see app/app/orders/page.tsx). The register writes
//                           it; the RPCs above do not.
//
// An order carrying neither was rung at the counter, which is what "In-store"
// means here.

export const CHANNELS = [
  "dine_in",
  "takeout",
  "pickup",
  "delivery",
  "in_store",
] as const;

export type ChannelKey = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<ChannelKey, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  pickup: "Pickup",
  delivery: "Delivery",
  in_store: "In-store",
};

/**
 * KNOWN DEFECT, PRESERVED ON PURPOSE.
 *
 * The delivery arm matches by substring, so an order whose channel is literally
 * 'doordash', 'ubereats' or 'grubhub' does not match and falls through to
 * in_store. Only 'delivery' — which migration 0074 uses as the fallback slug for
 * platforms it does not recognise — is classified correctly. 'kiosk', 'online'
 * and 'qr' land in in_store too.
 *
 * That is wrong, and it is wrong in /app/reports today. It was NOT fixed while
 * lifting this function, because correcting it changes the figures on a
 * financial report, and changing a report's numbers inside a dashboard restyle
 * is how a reporting discrepancy ships without anyone noticing. It wants its
 * own change with its own before-and-after. See docs/dashboard-overview-audit.md.
 *
 * /app/insights has a third, different and actually-correct channel map that
 * ignores dining_option entirely. Three views, three answers. Same note applies.
 */
export function channelOf(o: Record<string, unknown>): ChannelKey {
  const snap = (o.snapshot ?? null) as { dining_option?: string | null } | null;
  const d = (snap?.dining_option ?? "").toLowerCase();
  if (d === "dine_in" || d === "takeout" || d === "pickup" || d === "delivery") return d;
  const c = ((o.channel as string | null) ?? "").toLowerCase();
  if (c.includes("delivery")) return "delivery";
  if (c.includes("pickup")) return "pickup";
  if (c.includes("takeout") || c.includes("togo")) return "takeout";
  return "in_store";
}

export type ChannelCount = {
  key: ChannelKey;
  label: string;
  count: number;
  /** Share of the counted orders, 0–100, rounded so the set sums to exactly 100. */
  pct: number;
};

/**
 * Orders grouped by how they arrived, largest first, empty buckets dropped.
 *
 * Counts rather than money on purpose: this answers "what kind of service is
 * running right now", and a delivery order and a dine-in cover are one order
 * each whatever they rang. The money version of this question is the channel
 * table on /app/reports, which has room to say so properly.
 *
 * Percentages are rounded by largest remainder, the same way paymentMix() does
 * it, so the segmented bar's widths add to the full track instead of leaving a
 * one-pixel gap that looks like a rendering bug.
 *
 * CHANNELS order is the tiebreak, not alphabetical: two buckets of equal size
 * must not swap places between renders, and dine-in before takeout before
 * delivery is the order a restaurant would say them in.
 */
export function channelMix(orders: Record<string, unknown>[]): ChannelCount[] {
  const counts = new Map<ChannelKey, number>();
  for (const o of orders) {
    const k = channelOf(o);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const total = orders.length;
  if (total <= 0) return [];

  const rows = CHANNELS.filter((k) => (counts.get(k) ?? 0) > 0).map((k) => {
    const count = counts.get(k) ?? 0;
    const exact = (count / total) * 100;
    return { key: k, label: CHANNEL_LABEL[k], count, exact, pct: Math.floor(exact) };
  });

  rows.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : CHANNELS.indexOf(a.key) - CHANNELS.indexOf(b.key)
  );

  let remaining = 100 - rows.reduce((s, r) => s + r.pct, 0);
  const byRemainder = [...rows].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact))
  );
  for (let i = 0; remaining > 0 && i < byRemainder.length; i++, remaining--) {
    byRemainder[i].pct += 1;
  }

  return rows.map(({ key, label, count, pct }) => ({ key, label, count, pct }));
}
