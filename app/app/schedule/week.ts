// Pure week/date helpers for the schedule (usable in server + client).

export function todayKey(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// The UTC instant of 00:00 wall-clock in `tz` on dateStr (YYYY-MM-DD).
export function localMidnightUtc(dateStr: string, tz: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, (mo || 1) - 1, d || 1, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hr = g("hour") === 24 ? 0 : g("hour");
  const tzWall = Date.UTC(g("year"), g("month") - 1, g("day"), hr, g("minute"));
  return new Date(guess - (tzWall - guess)).toISOString();
}

export function mondayOf(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1));
  const back = (dt.getUTCDay() + 6) % 7; // 0=Sun -> 6 back; Mon -> 0
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function weekDays(mondayStr: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));
}
