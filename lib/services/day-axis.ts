// A continuous run of calendar days, for charting a range day by day.
//
// WHY THIS IS NOT A LOOP OVER `now - i * 86400000`.
//
// That is the obvious way to walk back through a week, and it is wrong twice a
// year in every timezone that observes DST. A local calendar day is 23 hours
// long at the spring transition and 25 at the autumn one, so a fixed 24-hour
// step either jumps clean over a local day — which then silently vanishes from
// the chart — or lands inside the same one twice. A restaurant looking at
// week-over-week momentum gets six bars where it asked for seven and nothing
// says so.
//
// Day KEYS are exactly 86400000 ms apart when built with Date.UTC, because UTC
// has no transitions at all. So: resolve the local calendar day once per
// timestamp (that is what dayKey does, with Intl and the business timezone),
// then generate the axis from the key strings in UTC. The timezone is already
// baked into the keys by the time this function sees them.

/** `YYYY-MM-DD`, the shape `Intl.DateTimeFormat("en-CA", …)` produces. */
export type DayKey = string;

const DAY_MS = 86_400_000;

/** Midnight UTC of the calendar date a key names. */
export function utcDayMs(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** The key for a UTC-midnight instant produced by `utcDayMs`. */
export function dayKeyFromUtcMs(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Every calendar day from `fromKey` to `toKey` inclusive, oldest first.
 *
 * Returns `[]` when the range runs backwards rather than throwing — a caller
 * that gets a nonsense custom range should draw nothing, not crash the report.
 * `maxDays` caps the run: a custom range can be arbitrarily long, and past a
 * quarter the bars stop being legible and the axis stops being a shape.
 */
export function dayAxis(fromKey: DayKey, toKey: DayKey, maxDays = 92): DayKey[] {
  const from = utcDayMs(fromKey);
  const to = utcDayMs(toKey);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  const out: DayKey[] = [];
  for (let t = from; t <= to && out.length < maxDays; t += DAY_MS) {
    out.push(dayKeyFromUtcMs(t));
  }
  return out;
}

/** True when `maxDays` cut the run short, so the caller can say so on screen. */
export function dayAxisTruncated(fromKey: DayKey, toKey: DayKey, maxDays = 92): boolean {
  const from = utcDayMs(fromKey);
  const to = utcDayMs(toKey);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return false;
  return to > from + (maxDays - 1) * DAY_MS;
}
