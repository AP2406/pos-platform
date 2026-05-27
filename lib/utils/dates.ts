// Timezone-aware date helpers.

export function getTodayBoundsUTC(timezone: string): {
  start: Date;
  end: Date;
} {
  return getDayBoundsUTC(new Date(), timezone);
}

export function getDayBoundsUTC(
  date: Date,
  timezone: string
): { start: Date; end: Date } {
  const localDateStr = date.toLocaleDateString("en-CA", {
    timeZone: timezone,
  });

  const probeUTC = new Date(`${localDateStr}T12:00:00Z`);
  const offsetStr =
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
      .formatToParts(probeUTC)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";

  const match = offsetStr.match(/GMT([+-]\d{2}):(\d{2})/);
  let offsetMinutes = 0;
  if (match) {
    const hours = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    offsetMinutes = hours * 60 + (hours < 0 ? -mins : mins);
  }

  const [year, month, day] = localDateStr.split("-").map(Number);
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  startUTC.setMinutes(startUTC.getMinutes() - offsetMinutes);

  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { start: startUTC, end: endUTC };
}

// Monday 00:00 → next Monday 00:00, in the business timezone
export function getWeekBoundsUTC(timezone: string): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const [year, month, day] = localDateStr.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - daysToMonday);

  const mondayStr = date.toISOString().split("T")[0];
  const { start } = getDayBoundsUTC(
    new Date(mondayStr + "T12:00:00Z"),
    timezone
  );

  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

// 1st of month 00:00 → 1st of next month 00:00, in the business timezone
export function getMonthBoundsUTC(timezone: string): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const [year, month] = localDateStr.split("-").map(Number);

  const firstDayStr = `${year}-${String(month).padStart(2, "0")}-01`;
  const { start } = getDayBoundsUTC(
    new Date(firstDayStr + "T12:00:00Z"),
    timezone
  );

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const firstNextStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const { start: end } = getDayBoundsUTC(
    new Date(firstNextStr + "T12:00:00Z"),
    timezone
  );

  return { start, end };
}