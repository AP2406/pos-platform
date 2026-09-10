export function money(n: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
}

// Minutes since an ISO timestamp (null on missing/invalid).
export function minutesSince(iso: string | null | undefined, nowMs?: number): number | null {
  if (!iso) return null;
  const start = new Date(iso).getTime();
  if (isNaN(start)) return null;
  return Math.max(0, Math.floor(((nowMs ?? Date.now()) - start) / 60000));
}

// Elapsed, formatted for the floor. Capped so a bad/stale timestamp can never
// render nonsense like "23d 6h" (the audit's floor-duration bug): anything a day
// or more shows "24h+".
export function formatElapsed(iso: string | null | undefined, nowMs?: number): string {
  const mins = minutesSince(iso, nowMs);
  if (mins == null) return "";
  if (mins >= 24 * 60) return "24h+";
  if (mins < 60) return mins + "m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}

// Floor v2 service-board duration: the REAL elapsed time, uncapped — "18 min",
// "1h 05m" (zero-padded). A seated table's clock should read true, never the
// blunt "24h+" of formatElapsed; the aging badge, not a cap, flags over-time.
export function formatDuration(iso: string | null | undefined, nowMs?: number): string {
  const mins = minutesSince(iso, nowMs);
  if (mins == null) return "";
  if (mins < 60) return mins + " min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + "h " + String(m).padStart(2, "0") + "m";
}

// Compact "how far past the threshold": "25m" under an hour, "3h" after that.
export function formatOverdue(minutes: number): string {
  if (minutes < 60) return minutes + "m";
  return Math.floor(minutes / 60) + "h";
}
