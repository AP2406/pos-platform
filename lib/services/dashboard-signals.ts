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
