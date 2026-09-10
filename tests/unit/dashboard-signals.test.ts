import { describe, it, expect } from "vitest";
import {
  agingThresholds,
  computePace,
  cumulativeCurve,
  minutesSince,
  niceCeiling,
  paymentMix,
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

describe("the cumulative sales curve", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = 1_000_000_000_000;

  it("accumulates rather than reporting each interval on its own", () => {
    const curve = cumulativeCurve(
      [
        { at: start + DAY * 0.1, amount: 100 },
        { at: start + DAY * 0.6, amount: 50 },
      ],
      start,
      DAY,
      4
    );
    expect(curve).toEqual([100, 100, 150, 150]);
  });

  it("drops timestamps outside the day instead of clamping them", () => {
    // A clamped stray row lands on the first or last sample and reads as a
    // rush that never happened.
    const curve = cumulativeCurve(
      [
        { at: start - 60_000, amount: 900 },
        { at: start + DAY + 60_000, amount: 900 },
        { at: start + DAY * 0.5, amount: 10 },
      ],
      start,
      DAY,
      4
    );
    expect(curve).toEqual([0, 0, 10, 10]);
  });

  it("survives the rows a real table hands back", () => {
    const curve = cumulativeCurve(
      [
        { at: null, amount: 500 },
        { at: "not a date", amount: 500 },
        { at: new Date(start + DAY * 0.3).toISOString(), amount: 25 },
      ],
      start,
      DAY,
      2
    );
    expect(curve).toEqual([25, 25]);
  });

  it("returns a flat zero day rather than nothing, so the caller decides", () => {
    // "No sales" and "no curve" are different answers; only the page knows
    // whether a zero day is worth drawing.
    expect(cumulativeCurve([], start, DAY, 3)).toEqual([0, 0, 0]);
  });
});

describe("chart ticks a person would say out loud", () => {
  it("snaps up to a round number", () => {
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(1640)).toBe(2000);
    expect(niceCeiling(2100)).toBe(2500);
    expect(niceCeiling(64_124)).toBe(80_000);
    expect(niceCeiling(4_800)).toBe(5000);
  });

  it("stays close enough that a real day fills its chart", () => {
    // A $14,570 day on a $20,000 axis spends a third of the box on nothing.
    expect(niceCeiling(14_570)).toBe(15_000);
    expect(niceCeiling(310)).toBe(400);
  });

  it("has no tick to offer for an empty day", () => {
    expect(niceCeiling(0)).toBe(0);
    expect(niceCeiling(-5)).toBe(0);
    expect(niceCeiling(Number.NaN)).toBe(0);
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

describe("paymentMix", () => {
  // The legend is the chart. Percentages that don't add to 100 make an owner
  // distrust every other figure on the page, so the arithmetic is the test.

  it("sums to exactly 100 where naive rounding would give 101", () => {
    const mix = paymentMix([
      { method: "cash", amount: 100 },
      { method: "card", amount: 100 },
      { method: "other", amount: 100 },
    ]);
    expect(mix.reduce((s, x) => s + x.pct, 0)).toBe(100);
    expect(mix.map((x) => x.pct).sort()).toEqual([33, 33, 34]);
  });

  it("sums to exactly 100 across seven uneven tenders", () => {
    const mix = paymentMix([
      { method: "card", amount: 913.4 },
      { method: "cash", amount: 271.15 },
      { method: "gift_card", amount: 44.9 },
      { method: "store_credit", amount: 12.05 },
      { method: "delivery", amount: 188.7 },
      { method: "split", amount: 61.3 },
      { method: "other", amount: 7.75 },
    ]);
    expect(mix).toHaveLength(7);
    expect(mix.reduce((s, x) => s + x.pct, 0)).toBe(100);
  });

  it("ranks by money taken, biggest first", () => {
    const mix = paymentMix([
      { method: "cash", amount: 10 },
      { method: "card", amount: 90 },
    ]);
    expect(mix.map((x) => x.key)).toEqual(["card", "cash"]);
    expect(mix[0].pct).toBe(90);
  });

  it("folds unknown and missing methods into Other rather than dropping them", () => {
    // A slice that silently vanished would leave the remaining percentages
    // describing a smaller day than the hero number just claimed.
    const mix = paymentMix([
      { method: "card", amount: 50 },
      { method: null, amount: 25 },
      { method: "crypto", amount: 25 },
    ]);
    expect(mix.reduce((s, x) => s + x.amount, 0)).toBe(100);
    const other = mix.find((x) => x.key === "other");
    expect(other?.pct).toBe(50);
    expect(other?.count).toBe(2);
  });

  it("gives every tender its own hue, so no two slices share a colour", () => {
    const mix = paymentMix([
      { method: "card", amount: 5 },
      { method: "cash", amount: 5 },
      { method: "gift_card", amount: 5 },
      { method: "store_credit", amount: 5 },
      { method: "delivery", amount: 5 },
      { method: "split", amount: 5 },
      { method: "other", amount: 5 },
    ]);
    expect(new Set(mix.map((x) => x.hue)).size).toBe(mix.length);
  });

  it("returns nothing at all when no money was taken", () => {
    // Not a set of zero-percent slices — a donut of nothing is a picture of
    // nothing, and the caller writes a sentence instead.
    expect(paymentMix([])).toEqual([]);
    expect(paymentMix([{ method: "cash", amount: 0 }])).toEqual([]);
  });

  it("keeps a comped sale out of the ring but still counts it", () => {
    const mix = paymentMix([
      { method: "card", amount: 100 },
      { method: "cash", amount: 0 },
    ]);
    expect(mix.map((x) => x.key)).toEqual(["card"]);
    expect(mix[0].pct).toBe(100);
  });

  it("orders ties by key so slices don't swap places between renders", () => {
    const a = paymentMix([
      { method: "cash", amount: 50 },
      { method: "card", amount: 50 },
    ]);
    const b = paymentMix([
      { method: "card", amount: 50 },
      { method: "cash", amount: 50 },
    ]);
    expect(a.map((x) => x.key)).toEqual(b.map((x) => x.key));
  });
});
