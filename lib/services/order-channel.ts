import { isDeliveryChannel } from "@surge/api-contracts";

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

// The delivery list is in the shared package, not here: the iPad app classifies
// orders too and cannot import from lib/. Three private copies of it were the
// actual defect, each failing differently. Re-exported so existing importers of
// this module keep working.
export { DELIVERY_CHANNELS, isDeliveryChannel } from "@surge/api-contracts";

/**
 * TWO AXES, FIVE BUCKETS — which is the whole difficulty here.
 *
 * `channel` says how the order ARRIVED (kiosk, online, qr, a delivery
 * platform). `dining_option` says how the food LEAVES (dine in, takeout,
 * pickup, delivery). They are independent facts, and ChannelKey has five slots
 * for both of them, so every value has to be placed deliberately:
 *
 *   doordash | ubereats | grubhub | delivery  -> delivery
 *     0074 normalises any unrecognised platform to the literal 'delivery', so
 *     these four are the complete set. A third-party order IS a delivery
 *     however the check was flagged, which is why this arm outranks
 *     dining_option below.
 *   online -> pickup      0072 calls it "an online pickup order": ordered
 *                         ahead, collected in person.
 *   qr     -> dine_in     0073 is guest-pay — someone sitting at a table
 *                         settling their own check.
 *   kiosk  -> takeout     0071 tags a togo check placed at an on-premise
 *                         self-serve kiosk.
 *   NULL   -> whatever the register wrote, else in_store.
 *
 * WHAT CHANGED, AND WHY THE NUMBERS MOVE. This previously matched by substring,
 * so 'doordash', 'ubereats' and 'grubhub' all missed the delivery arm and fell
 * through to in_store, as did 'kiosk', 'online' and 'qr'. Only the literal
 * 'delivery' — the fallback slug for platforms 0074 does not recognise — landed
 * correctly. In-store was therefore absorbing every non-register channel, and
 * /app/reports has been reporting it that way. Correcting it moves real figures
 * on a financial report; see docs/order-channel-correction.md for the
 * before-and-after.
 *
 * An unrecognised non-null channel still falls to in_store, which is the same
 * shape of bug for whatever surface gets added next. It is deliberate rather
 * than forgotten: there is no "other" bucket to put it in without changing what
 * the report's table looks like. Add the slug here when you add the surface.
 */
const CHANNEL_TO_KEY: Record<string, ChannelKey> = {
  online: "pickup",
  qr: "dine_in",
  kiosk: "takeout",
};

export function channelOf(o: Record<string, unknown>): ChannelKey {
  const c = ((o.channel as string | null) ?? "").toLowerCase().trim();

  // A third-party platform is definitive about fulfilment, so it is read before
  // the snapshot rather than after it.
  if (isDeliveryChannel(c)) return "delivery";

  // The register's own statement of how the food leaves wins next.
  const snap = (o.snapshot ?? null) as { dining_option?: string | null } | null;
  const d = (snap?.dining_option ?? "").toLowerCase();
  if (d === "dine_in" || d === "takeout" || d === "pickup" || d === "delivery") return d;

  return CHANNEL_TO_KEY[c] ?? "in_store";
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
