// Overtime config + per-week OT split. Ontario ESA default: 44h/week at 1.5×.
// Stored on businesses.settings.overtime { weekly_hours, multiplier }.

export type OvertimeCfg = { weeklyHours: number; multiplier: number };

export function parseOvertime(settings: unknown): OvertimeCfg {
  const o = (settings as { overtime?: { weekly_hours?: unknown; multiplier?: unknown } } | null)?.overtime ?? {};
  const weeklyHours = Number(o.weekly_hours);
  const multiplier = Number(o.multiplier);
  return {
    weeklyHours: Number.isFinite(weeklyHours) && weeklyHours > 0 ? weeklyHours : 44,
    multiplier: Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : 1.5,
  };
}

// The Monday (local date, YYYY-MM-DD) of the ISO week containing `iso`, used to
// bucket hours into weeks for the weekly OT threshold.
export function weekKey(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(iso));
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd); // 0..6
  const back = (idx + 6) % 7; // days since Monday
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() - back);
  return base.toISOString().slice(0, 10);
}

// Split a set of weekly-hour totals into regular vs OT hours given the threshold.
export function splitOtHours(hoursByWeek: number[], weeklyHours: number): { regular: number; ot: number } {
  let regular = 0, ot = 0;
  for (const h of hoursByWeek) {
    const r = Math.min(h, weeklyHours);
    regular += r;
    ot += Math.max(0, h - weeklyHours);
  }
  return { regular: Math.round(regular * 100) / 100, ot: Math.round(ot * 100) / 100 };
}
