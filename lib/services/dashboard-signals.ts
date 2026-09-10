// The two judgements the admin home page makes, kept out of the JSX.
//
// Both are pure: the page fetches rows, these decide what any of it *means*.
// That split exists because the interesting cases here are the ones you can't
// see by loading the app — a tenant whose comparison day was also empty, a
// kitchen with one late ticket and six fine ones. Those are cheap to test and
// expensive to reproduce by hand.

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

// Same weekday last week, not yesterday. A restaurant's Tuesday looks nothing
// like its Monday, so "down 40% from yesterday" is noise every single Monday.
// Week-over-week on the same weekday is the only comparison an owner can act on.
//
// And it is compared *to the same point in the day*. Measuring today's 11am
// against last Wednesday's full service would report a catastrophe every
// morning, so the benchmark is truncated to the same elapsed time.

export type PaceStatus = "ahead" | "level" | "behind" | "no-benchmark";

export type Pace = {
  today: number;
  /** Same weekday last week, counted only up to the current time of day. */
  benchmarkSoFar: number;
  /** That same day's full total — where today is headed if it tracks. */
  benchmarkFull: number;
  /** Percent difference vs benchmarkSoFar; null when there's nothing to compare. */
  deltaPct: number | null;
  status: PaceStatus;
};

/**
 * Within this band, today and last week are the same day. Restaurant covers
 * swing several percent on weather alone; flagging a 3% gap as "behind" would
 * make the signal worthless.
 */
const LEVEL_BAND_PCT = 8;

export function computePace(
  today: number,
  benchmarkSoFar: number,
  benchmarkFull: number
): Pace {
  const t = Number.isFinite(today) ? today : 0;
  const soFar = Number.isFinite(benchmarkSoFar) ? benchmarkSoFar : 0;
  const full = Number.isFinite(benchmarkFull) ? benchmarkFull : 0;

  // No trading at all on the comparison day means there is no benchmark — not
  // that today is infinitely ahead. A new merchant lives here, and so does any
  // restaurant on its first Monday after opening.
  if (soFar <= 0) {
    return {
      today: t,
      benchmarkSoFar: soFar,
      benchmarkFull: full,
      deltaPct: null,
      status: "no-benchmark",
    };
  }

  const deltaPct = ((t - soFar) / soFar) * 100;
  const status: PaceStatus =
    Math.abs(deltaPct) <= LEVEL_BAND_PCT
      ? "level"
      : deltaPct > 0
        ? "ahead"
        : "behind";

  return { today: t, benchmarkSoFar: soFar, benchmarkFull: full, deltaPct, status };
}

// ---------------------------------------------------------------------------
// The cumulative sales curve
// ---------------------------------------------------------------------------

/** One settled sale, reduced to the two things a curve needs. */
export type CurvePoint = { at: string | number | null | undefined; amount: number };

/**
 * Takings accumulated across a day, sampled at `steps` even intervals.
 *
 * Cumulative rather than per-interval on purpose: half-hourly bars at a single
 * restaurant's volume are mostly noise, while the running total is the shape an
 * owner already carries in their head — "we were at four grand by eight". Two
 * of these on one axis *is* the pace comparison, drawn.
 *
 * Timestamps outside the day are dropped rather than clamped. Clamping would
 * pile a stray row onto the first or last sample and invent a spike, and this
 * function has no way to tell a timezone bug from a real late-night sale.
 */
export function cumulativeCurve(
  sales: CurvePoint[],
  startMs: number,
  lengthMs: number,
  steps: number
): number[] {
  const n = Math.max(1, Math.floor(steps));
  const buckets = new Array<number>(n).fill(0);
  if (!(lengthMs > 0)) return buckets;

  for (const s of sales) {
    const t =
      typeof s.at === "number" ? s.at : s.at ? new Date(s.at).getTime() : Number.NaN;
    if (!Number.isFinite(t)) continue;
    const frac = (t - startMs) / lengthMs;
    if (frac < 0 || frac >= 1) continue;
    buckets[Math.floor(frac * n)] += Number.isFinite(s.amount) ? s.amount : 0;
  }

  let running = 0;
  return buckets.map((b) => (running += b));
}

/**
 * The next round number at or above `value`, for a chart's top gridline.
 *
 * Lightspeed's axis reads $64,124 / $54,963 / $45,803 — computed from the
 * series max and legible to nobody. A tick is a reference point, so it has to
 * be a number a person would say out loud.
 */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Fine enough that a $14,570 day doesn't get a $20,000 axis and spend a
  // third of the chart drawing empty space, coarse enough that every rung is
  // still a round figure.
  const ladder = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  const step = ladder.find((s) => normalised <= s) ?? 10;
  return step * magnitude;
}

// ---------------------------------------------------------------------------
// Payment mix
// ---------------------------------------------------------------------------

/**
 * The tenders `orders.payment_method` is allowed to hold, in the order the
 * donut assigns colours. Fixed rather than discovered from the data so a
 * restaurant's cash slice is the same colour on Monday as it is on Friday —
 * a legend that reshuffles its hues between page loads is unreadable.
 *
 * `split` is a real order-level value (0027): a sale settled across two or more
 * tenders. It stays its own slice rather than being spread across the others,
 * because this page reads `orders`, and the per-tender breakdown of a split
 * lives in `payments`. Guessing it would be inventing money.
 */
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  split: "Split",
  gift_card: "Gift card",
  store_credit: "Store credit",
  delivery: "Delivery app",
  other: "Other",
};

/** Colour token index per tender, 1-based against --chart-N. */
const PAYMENT_HUE: Record<string, number> = {
  card: 1,
  cash: 3,
  delivery: 5,
  gift_card: 4,
  store_credit: 7,
  split: 2,
  other: 6,
};

export type PaymentSlice = {
  /** Normalised method key — always one of PAYMENT_LABELS' keys. */
  key: string;
  label: string;
  /** 1–7, the --chart-N token this slice is drawn in. */
  hue: number;
  amount: number;
  count: number;
  /** Whole percent of the total. The returned set always sums to exactly 100. */
  pct: number;
};

/**
 * Money taken, split by tender, largest first.
 *
 * The percentages are the point — this is the one chart on the page whose
 * legend is read instead of the picture — so they are rounded by largest
 * remainder rather than independently. Rounding each slice on its own gives
 * legends that read "34% · 33% · 34%" and sum to 101, which makes an owner
 * distrust every other number on the screen.
 *
 * Unknown or missing methods fold into "Other" instead of being dropped: a
 * slice that silently vanishes would make the remaining percentages describe a
 * smaller day than the one the hero number just claimed.
 */
export function paymentMix(
  rows: { method: unknown; amount: number }[]
): PaymentSlice[] {
  const byKey = new Map<string, { amount: number; count: number }>();
  let total = 0;

  for (const r of rows) {
    const raw = typeof r.method === "string" ? r.method.toLowerCase().trim() : "";
    const key = PAYMENT_LABELS[raw] ? raw : "other";
    const amount = Number.isFinite(r.amount) ? r.amount : 0;
    // A refunded-to-zero or comped sale has no arc to draw and no share to
    // claim, but it did happen, so it still counts toward `count`.
    const slot = byKey.get(key) ?? { amount: 0, count: 0 };
    slot.amount += amount;
    slot.count += 1;
    byKey.set(key, slot);
    total += amount;
  }

  if (total <= 0) return [];

  const slices = [...byKey.entries()]
    .filter(([, v]) => v.amount > 0)
    .map(([key, v]) => ({
      key,
      label: PAYMENT_LABELS[key],
      hue: PAYMENT_HUE[key] ?? 6,
      amount: v.amount,
      count: v.count,
      exact: (v.amount / total) * 100,
      pct: Math.floor((v.amount / total) * 100),
    }))
    // Biggest share first, then key, so two tenders that tie don't swap places
    // between renders.
    .sort((a, b) => (b.amount !== a.amount ? b.amount - a.amount : a.key < b.key ? -1 : 1));

  // Hand the floored-away points back to whoever lost the most to rounding.
  let remaining = 100 - slices.reduce((s, x) => s + x.pct, 0);
  const byRemainder = [...slices].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact))
  );
  for (let i = 0; remaining > 0 && i < byRemainder.length; i++, remaining--) {
    byRemainder[i].pct += 1;
  }

  return slices.map(({ key, label, hue, amount, count, pct }) => ({
    key,
    label,
    hue,
    amount,
    count,
    pct,
  }));
}

// ---------------------------------------------------------------------------
// The attention rail
// ---------------------------------------------------------------------------

// "Blocked" means service is stopped or money is unaccounted for — someone has
// to move now. "Attention" means it will bite later today. Nothing else earns a
// row: a count of zero is not a signal, it's a fact, and facts belong in the
// operational blocks below the rail.

export type SignalSeverity = "blocked" | "attention";

export type AttentionSignal = {
  id: string;
  severity: SignalSeverity;
  /** The state, stated as a fact. "3 tickets past 25 min". */
  title: string;
  /** Why it matters / what it costs. One line. */
  detail: string;
  /** The screen that resolves it — not a filtered list, the actual fix. */
  href: string;
  actionLabel: string;
  /**
   * Tiebreak inside a severity tier; higher is more urgent. Use the natural
   * magnitude of the thing (minutes late, dollars unreconciled, item count) so
   * two late tickets never outrank one that's been sitting for an hour.
   */
  weight: number;
};

const SEVERITY_ORDER: Record<SignalSeverity, number> = {
  blocked: 0,
  attention: 1,
};

/**
 * Severity first, then magnitude, then id so the order is stable between
 * renders — a rail that reshuffles on refresh is a rail nobody trusts.
 */
export function rankSignals(signals: AttentionSignal[]): AttentionSignal[] {
  return [...signals].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * "Too long" is the merchant's number, not ours.
 *
 * A ramen counter and a tasting menu disagree about when a ticket is late, and
 * both already told us: settings.kds.{warnMin,lateMin} drives the KDS, and
 * settings.table_aging.{yellow_min,red_min} drives the floor. The dashboard
 * reads the same values so a check the floor plan shows as red can't be absent
 * from the rail — one restaurant, one definition of late.
 *
 * The KDS page, the register's floor view and settings each still parse these
 * inline. Consolidating all four is a worthwhile cleanup but it touches the
 * register, so this only claims the dashboard's copy.
 */
export type AgingThresholds = {
  kdsWarnMin: number;
  kdsLateMin: number;
  checkWarnMin: number;
  checkLateMin: number;
};

export function agingThresholds(settings: unknown): AgingThresholds {
  const s =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};

  const kds = (s.kds ?? {}) as { warnMin?: unknown; lateMin?: unknown };
  const kdsWarnMin = Number(kds.warnMin) > 0 ? Number(kds.warnMin) : 10;
  const kdsLateMin =
    Number(kds.lateMin) > kdsWarnMin ? Number(kds.lateMin) : Math.max(kdsWarnMin + 1, 18);

  const table = (s.table_aging ?? {}) as { yellow_min?: unknown; red_min?: unknown };
  const checkWarnMin = Number(table.yellow_min) > 0 ? Number(table.yellow_min) : 45;
  const checkLateMin =
    Number(table.red_min) > checkWarnMin ? Number(table.red_min) : Math.max(checkWarnMin + 1, 90);

  return { kdsWarnMin, kdsLateMin, checkWarnMin, checkLateMin };
}

/** Minutes between an ISO timestamp and now, floored at zero. */
export function minutesSince(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 60000));
}
