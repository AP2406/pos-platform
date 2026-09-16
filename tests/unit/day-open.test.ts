import { describe, it, expect } from "vitest";
import { hoursDayOpen, dayOpenPhrase, STALE_DAY_HOURS } from "@/lib/services/day-open";

// The "you haven't ended your business day" warning.
//
// A nag has exactly two failure modes and both are decided by this function:
// it fires when it shouldn't (and the floor learns to ignore the banner), or
// it stays quiet when a week of sales are piling onto one Z-report. The tests
// below are mostly about the first one.

const NOW = Date.parse("2026-09-16T20:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("how long the day has been open", () => {
  it("says nothing during an ordinary day", () => {
    expect(hoursDayOpen(hoursAgo(9), NOW)).toBeNull();
    expect(hoursDayOpen(hoursAgo(23), NOW)).toBeNull();
  });

  it("stays quiet right up to the threshold, then speaks", () => {
    expect(hoursDayOpen(hoursAgo(STALE_DAY_HOURS - 0.1), NOW)).toBeNull();
    expect(hoursDayOpen(hoursAgo(STALE_DAY_HOURS), NOW)).toBe(24);
  });

  it("never nags a business that has never closed a drawer", () => {
    // The single most important case. A card-only shop that does not run a
    // till has not fallen behind on anything — it just does not work that way,
    // and a banner every shift would train the whole floor to ignore banners.
    expect(hoursDayOpen(null, NOW)).toBeNull();
    expect(hoursDayOpen(undefined, NOW)).toBeNull();
    expect(hoursDayOpen("", NOW)).toBeNull();
  });

  it("stays quiet rather than printing a negative age from a clock problem", () => {
    // A close timestamp in the future means someone's clock is wrong. "This day
    // has been open -3 hours" is worse than saying nothing.
    expect(hoursDayOpen(hoursAgo(-5), NOW)).toBeNull();
  });

  it("stays quiet on a timestamp it cannot read", () => {
    expect(hoursDayOpen("not a date", NOW)).toBeNull();
  });

  it("floors rather than rounds, so it never overstates", () => {
    // 47.9 hours is "47 hours", not "48" — which would cross into the "days"
    // wording below and claim two days that have not happened.
    expect(hoursDayOpen(hoursAgo(47.9), NOW)).toBe(47);
  });

  it("keeps counting for a genuinely abandoned day", () => {
    expect(hoursDayOpen(hoursAgo(24 * 9), NOW)).toBe(216);
  });
});

describe("how it says it", () => {
  it("counts hours for the first two days", () => {
    expect(dayOpenPhrase(24)).toBe("24 hours");
    expect(dayOpenPhrase(47)).toBe("47 hours");
  });

  it("switches to days once hours stop meaning anything", () => {
    // "73 hours" is arithmetic the reader has to do; "3 days" is a problem they
    // can feel.
    expect(dayOpenPhrase(48)).toBe("2 days");
    expect(dayOpenPhrase(73)).toBe("3 days");
    expect(dayOpenPhrase(216)).toBe("9 days");
  });

  it("gets the singular right at both scales", () => {
    expect(dayOpenPhrase(1)).toBe("1 hour");
    // 24-47 hours stays in hours, so "1 day" only appears if the threshold is
    // ever lowered — guard it anyway rather than ship "1 days" the day it is.
    expect(dayOpenPhrase(24)).toBe("24 hours");
  });
});
