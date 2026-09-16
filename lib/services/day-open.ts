// How long the current business day has been open, and how to say it.
//
// TouchBistro blocks its floor with a modal once a day has run more than 24
// hours: "You have not ended your business day in over 24 hours. We recommend
// you perform the End of Day before continuing", Cancel / End Day. The warning
// is right; blocking the floor with it is not. A server who needs to ring a
// drink should not meet a wall about last night's paperwork, and a modal whose
// safe answer is "Cancel" trains everyone to dismiss modals. Surge warns in a
// banner and lets the shift carry on.
//
// Separate from the page so the threshold and the wording are testable without
// a database: the failure mode of a nag is that it is either wrong or constant,
// and both of those are decisions made right here.

/** Hours after which an open day is worth mentioning. One full day, not a shift. */
export const STALE_DAY_HOURS = 24;

/**
 * Hours the day has been open, or null when it is not worth saying anything.
 *
 * Null covers three different "nothing to say" cases on purpose:
 *  - `closedAt` is null — this business has NEVER closed a drawer, so it does
 *    not work that way and is not behind on anything. Nagging it every shift
 *    would teach the whole floor to ignore the banner.
 *  - under the threshold — an ordinary day in progress.
 *  - a close timestamp in the future, or unparseable — a clock problem, and
 *    "this day has been open -3 hours" is worse than silence.
 */
export function hoursDayOpen(
  closedAt: string | null | undefined,
  now: number = Date.now(),
  thresholdHours: number = STALE_DAY_HOURS
): number | null {
  if (!closedAt) return null;
  const t = new Date(closedAt).getTime();
  if (!Number.isFinite(t)) return null;
  const hours = (now - t) / 3_600_000;
  if (!Number.isFinite(hours) || hours < thresholdHours) return null;
  return Math.floor(hours);
}

/**
 * "26 hours" / "3 days". Past two days an hour count stops being a quantity a
 * person can feel — "73 hours" is arithmetic, "3 days" is a problem.
 */
export function dayOpenPhrase(hours: number): string {
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return days + (days === 1 ? " day" : " days");
  }
  return hours + (hours === 1 ? " hour" : " hours");
}
