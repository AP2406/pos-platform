import { describe, it, expect } from "vitest";
import {
  agingThresholds,
  computePace,
  minutesSince,
  rankSignals,
  type AttentionSignal,
} from "@/lib/services/dashboard-signals";

// The admin dashboard's two judgements. Both matter most in the cases you can't
// see by opening the app: a tenant whose comparison day was also empty, a
// kitchen with one badly late ticket and six fine ones, a merchant who set
// their own idea of "late" in settings.

describe("pace against the same weekday last week", () => {
  it("reports no benchmark when last week's same weekday was also empty", () => {
    // The case that actually ships. A new merchant, or a restaurant on its
    // first Monday, has nothing to compare against — and "infinitely ahead" is
    // not the answer.
    const p = computePace(0, 0, 0);
    expect(p.status).toBe("no-benchmark");
    expect(p.deltaPct).toBeNull();
  });

  it("still reports no benchmark when today sold and last week did not", () => {
    // Dividing by a zero benchmark would render "+Infinity% ahead".
    const p = computePace(420, 0, 0);
    expect(p.status).toBe("no-benchmark");
    expect(p.deltaPct).toBeNull();
    expect(p.today).toBe(420);
  });

  it("calls a small gap level rather than crying behind", () => {
    // Covers swing several percent on weather alone. A dashboard that flags
    // that as a problem is a dashboard people stop reading.
    expect(computePace(1000, 1050, 2000).status).toBe("level");
    expect(computePace(1050, 1000, 2000).status).toBe("level");
  });

  it("flags a real gap in both directions", () => {
    expect(computePace(500, 1000, 2000).status).toBe("behind");
    expect(computePace(2000, 1000, 2000).status).toBe("ahead");
    expect(computePace(500, 1000, 2000).deltaPct).toBe(-50);
  });

  it("zero today against a busy last week is behind, not broken", () => {
    const p = computePace(0, 800, 2400);
    expect(p.status).toBe("behind");
    expect(p.deltaPct).toBe(-100);
    // The full-day figure survives so the page can still draw the finish line.
    expect(p.benchmarkFull).toBe(2400);
  });
});

describe("the attention rail's order", () => {
  const signal = (
    id: string,
    severity: AttentionSignal["severity"],
    weight: number
  ): AttentionSignal => ({
    id,
    severity,
    title: id,
    detail: "",
    href: "/app",
    actionLabel: "Go",
    weight,
  });

  it("puts anything blocked above anything merely worth attention", () => {
    const ranked = rankSignals([
      signal("low-stock", "attention", 9999),
      signal("approvals", "blocked", 1),
    ]);
    expect(ranked.map((s) => s.id)).toEqual(["approvals", "low-stock"]);
  });

  it("ranks by magnitude inside a tier, so one hour-old ticket beats two new ones", () => {
    const ranked = rankSignals([
      signal("two-new", "attention", 2),
      signal("one-old", "attention", 60),
    ]);
    expect(ranked[0].id).toBe("one-old");
  });

  it("is stable when weight and severity tie", () => {
    const a = rankSignals([signal("b", "attention", 5), signal("a", "attention", 5)]);
    const b = rankSignals([signal("a", "attention", 5), signal("b", "attention", 5)]);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  it("does not mutate the caller's array", () => {
    const input = [signal("z", "attention", 1), signal("a", "blocked", 1)];
    rankSignals(input);
    expect(input.map((s) => s.id)).toEqual(["z", "a"]);
  });
});

describe("aging thresholds come from the merchant, not from us", () => {
  it("falls back to the KDS and floor defaults when nothing is configured", () => {
    expect(agingThresholds(null)).toEqual({
      kdsWarnMin: 10,
      kdsLateMin: 18,
      checkWarnMin: 45,
      checkLateMin: 90,
    });
    expect(agingThresholds({})).toEqual(agingThresholds(undefined));
  });

  it("honours what the merchant set in settings", () => {
    const t = agingThresholds({
      kds: { warnMin: 5, lateMin: 12 },
      table_aging: { yellow_min: 30, red_min: 50 },
    });
    expect(t).toEqual({
      kdsWarnMin: 5,
      kdsLateMin: 12,
      checkWarnMin: 30,
      checkLateMin: 50,
    });
  });

  it("never lets late land at or below warn, however the setting was stored", () => {
    const t = agingThresholds({
      kds: { warnMin: 30, lateMin: 5 },
      table_aging: { yellow_min: 120, red_min: 10 },
    });
    expect(t.kdsLateMin).toBeGreaterThan(t.kdsWarnMin);
    expect(t.checkLateMin).toBeGreaterThan(t.checkWarnMin);
  });

  it("ignores junk rather than propagating NaN into a comparison", () => {
    const t = agingThresholds({ kds: { warnMin: "soon" }, table_aging: { red_min: null } });
    expect(t.kdsWarnMin).toBe(10);
    expect(t.checkLateMin).toBe(90);
  });
});

describe("minutesSince", () => {
  const now = Date.parse("2026-09-10T18:00:00Z");

  it("measures elapsed minutes", () => {
    expect(minutesSince("2026-09-10T17:15:00Z", now)).toBe(45);
  });

  it("treats a missing or unparseable timestamp as zero, never NaN", () => {
    expect(minutesSince(null, now)).toBe(0);
    expect(minutesSince("not a date", now)).toBe(0);
  });

  it("never goes negative on a clock that ran backwards", () => {
    expect(minutesSince("2026-09-10T19:00:00Z", now)).toBe(0);
  });
});
