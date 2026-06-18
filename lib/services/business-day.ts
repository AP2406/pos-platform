// Business-day attribution. A restaurant's "day" doesn't end at midnight — late
// sales (e.g. 2am) belong to the prior business day. The cutoff (HH:MM, local to
// the business timezone) defines the boundary: anything before the cutoff rolls
// to the previous calendar day.

export function parseCutoff(
  settings: Record<string, unknown> | null | undefined
): string {
  const c =
    settings && typeof settings === "object"
      ? (settings as { business_day_cutoff?: unknown }).business_day_cutoff
      : undefined;
  if (typeof c === "string" && /^\d{1,2}:\d{2}$/.test(c)) return c;
  return "00:00";
}

// Returns the business date ("YYYY-MM-DD") for an instant, given the cutoff and
// the business timezone.
export function businessDateFor(
  iso: string,
  cutoff: string,
  timeZone: string
): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  let y = Number(get("year"));
  let mo = Number(get("month"));
  let da = Number(get("day"));
  const hRaw = get("hour");
  const hh = Number(hRaw === "24" ? "0" : hRaw); // some envs render midnight as 24
  const mm = Number(get("minute"));

  const [ch, cm] = cutoff.split(":").map((x) => Number(x) || 0);
  if (hh * 60 + mm < ch * 60 + cm) {
    const prev = new Date(Date.UTC(y, mo - 1, da));
    prev.setUTCDate(prev.getUTCDate() - 1);
    y = prev.getUTCFullYear();
    mo = prev.getUTCMonth() + 1;
    da = prev.getUTCDate();
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}
