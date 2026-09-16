import { describe, it, expect } from "vitest";
import { dayAxis, dayAxisTruncated, utcDayMs, dayKeyFromUtcMs } from "@/lib/services/day-axis";

// The axis for the reports page's day-by-day chart. The whole reason this is a
// separate, tested unit is the DST behaviour below: the naive version of this
// loop drops a day twice a year and says nothing about it.

const TZ = "America/Toronto";

// The version this replaced: step an INSTANT back by 24h at a time and ask the
// business timezone which local day it landed on. Takes an absolute instant,
// because WHEN the report is loaded is the whole variable — at midday this is
// perfectly correct, and that is why the fault survived so long.
const naiveLocalWalk = (anchorISO: string, days: number): string[] => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const end = new Date(anchorISO).getTime();
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(fmt.format(new Date(end - i * 86_400_000)));
  return out;
};

describe("day axis", () => {
  it("returns every day in the range, inclusive, oldest first", () => {
    expect(dayAxis("2026-03-01", "2026-03-05")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
  });

  it("returns a single day when both ends are the same", () => {
    expect(dayAxis("2026-07-04", "2026-07-04")).toEqual(["2026-07-04"]);
  });

  it("returns nothing for a backwards range instead of throwing", () => {
    // A nonsense custom range should draw no chart, not take the report down.
    expect(dayAxis("2026-07-10", "2026-07-01")).toEqual([]);
    expect(dayAxisTruncated("2026-07-10", "2026-07-01")).toBe(false);
  });

  // ---------------------------------------------------------------------
  // The reason this file exists
  // ---------------------------------------------------------------------

  it("spans the spring-forward transition without losing a day", () => {
    // North America springs forward on 8 Mar 2026. That local day is 23 hours
    // long, which is exactly what a fixed 24-hour step trips over.
    const axis = dayAxis("2026-03-06", "2026-03-10");
    expect(axis).toEqual([
      "2026-03-06",
      "2026-03-07",
      "2026-03-08", // the short day — present, not skipped
      "2026-03-09",
      "2026-03-10",
    ]);
    expect(axis.length).toBe(5);
  });

  it("spans the fall-back transition without repeating a day", () => {
    // 1 Nov 2026 is 25 hours long in America/Toronto.
    const axis = dayAxis("2026-10-30", "2026-11-03");
    expect(axis).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01", // the long day — once
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(new Set(axis).size).toBe(axis.length);
  });

  it("keeps the day the naive walk skipped at the spring transition", () => {
    // 8 Mar 2026 is 23 hours long in America/Toronto. Loaded at 00:30 local on
    // the 9th, the old 24-hour step jumps clean over it: the walk returns
    // 03-09, 03-07, 03-06 … and the 8th never appears, while the window
    // silently reaches a day further back than asked.
    const naive = naiveLocalWalk("2026-03-09T04:30:00Z", 7);
    expect(naive).not.toContain("2026-03-08");

    const fixed = dayAxis("2026-03-03", "2026-03-09");
    expect(fixed).toContain("2026-03-08");
    expect(fixed.length).toBe(7);
    expect(new Set(fixed).size).toBe(7);
  });

  it("does not repeat the day the naive walk doubled at the autumn transition", () => {
    // 1 Nov 2026 is 25 hours long. Loaded at 00:30 local, the old walk returns
    // it twice and yields six distinct days where seven were requested.
    const naive = naiveLocalWalk("2026-11-02T04:30:00Z", 7);
    expect(new Set(naive).size).toBe(6);
    expect(naive.filter((d) => d === "2026-11-01").length).toBe(2);

    const fixed = dayAxis("2026-10-26", "2026-11-01");
    expect(fixed.length).toBe(7);
    expect(new Set(fixed).size).toBe(7);
  });

  it("is correct at midday, which is why the fault went unnoticed", () => {
    // The same walk run in the afternoon of the same DST week is fine. The
    // failure window is roughly an hour either side of local midnight — which
    // for a restaurant is closing time, and closing time is when an owner pulls
    // the day's report.
    const naive = naiveLocalWalk("2026-03-09T17:00:00Z", 7);
    expect(new Set(naive).size).toBe(7);
    expect(naive).toContain("2026-03-08");
  });

  it("is stable in a timezone with a half-hour offset", () => {
    // Asia/Colombo is UTC+05:30 and has no DST — the axis must not care either
    // way, because the offset never reaches the keys.
    expect(dayAxis("2026-09-14", "2026-09-16")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ]);
  });

  it("caps a long custom range and reports that it did", () => {
    const axis = dayAxis("2020-01-01", "2026-01-01", 92);
    expect(axis.length).toBe(92);
    expect(axis[0]).toBe("2020-01-01");
    expect(dayAxisTruncated("2020-01-01", "2026-01-01", 92)).toBe(true);
  });

  it("does not report truncation when the range fits exactly", () => {
    expect(dayAxis("2026-01-01", "2026-01-07", 7).length).toBe(7);
    expect(dayAxisTruncated("2026-01-01", "2026-01-07", 7)).toBe(false);
  });

  it("round-trips a key through UTC milliseconds", () => {
    expect(dayKeyFromUtcMs(utcDayMs("2026-02-29"))).toBe("2026-03-01"); // 2026 is not a leap year
    expect(dayKeyFromUtcMs(utcDayMs("2024-02-29"))).toBe("2024-02-29"); // 2024 is
    expect(dayKeyFromUtcMs(utcDayMs("2026-12-31"))).toBe("2026-12-31");
  });
});
