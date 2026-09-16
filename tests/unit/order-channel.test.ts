import { describe, it, expect } from "vitest";
import { channelMix, channelOf } from "@/lib/services/order-channel";

// How an order reached us. Shared by /app/reports and the admin home, which is
// why it is worth pinning: the two screens are now required to agree, including
// about the cases below where the current answer is WRONG.

describe("channel classification", () => {
  it("prefers the snapshot's dining option, which only the register writes", () => {
    expect(channelOf({ snapshot: { dining_option: "dine_in" }, channel: null })).toBe(
      "dine_in"
    );
    expect(channelOf({ snapshot: { dining_option: "takeout" }, channel: null })).toBe(
      "takeout"
    );
  });

  it("treats an order with neither field as a counter sale", () => {
    // NULL channel and no snapshot is what a till writes, and "In-store" is what
    // that means. It is not "unknown" and it is not dropped.
    expect(channelOf({})).toBe("in_store");
    expect(channelOf({ channel: null, snapshot: null })).toBe("in_store");
  });

  it("lets the snapshot outrank the column when both are set", () => {
    expect(
      channelOf({ snapshot: { dining_option: "delivery" }, channel: "online" })
    ).toBe("delivery");
  });

  it("keeps pickup as its own bucket rather than folding it into takeout", () => {
    // The mockup asked for a three-way split. Pickup is a first-class dining
    // option the register offers, and folding it into Takeout would silently
    // reclassify real money.
    expect(channelOf({ snapshot: { dining_option: "pickup" } })).toBe("pickup");
  });

  // ---------------------------------------------------------------------
  // The defect, pinned deliberately
  // ---------------------------------------------------------------------
  //
  // These assertions describe behaviour that is WRONG. They are here so that
  // whoever fixes it has to come and change them on purpose, rather than
  // discovering afterwards that /app/reports' channel table moved.
  // See docs/dashboard-overview-audit.md §4.

  it("KNOWN DEFECT: files a named delivery platform as In-store", () => {
    // migration 0074 writes 'doordash' | 'ubereats' | 'grubhub' and only falls
    // back to the literal 'delivery' for platforms it does not recognise, but
    // the classifier matches delivery by substring — so the three real platforms
    // miss and the unknown-platform fallback is the only one that lands.
    expect(channelOf({ channel: "doordash" })).toBe("in_store");
    expect(channelOf({ channel: "ubereats" })).toBe("in_store");
    expect(channelOf({ channel: "grubhub" })).toBe("in_store");
    expect(channelOf({ channel: "delivery" })).toBe("delivery");
  });

  it("KNOWN DEFECT: files kiosk, online and QR orders as In-store", () => {
    expect(channelOf({ channel: "kiosk" })).toBe("in_store");
    expect(channelOf({ channel: "online" })).toBe("in_store");
    expect(channelOf({ channel: "qr" })).toBe("in_store");
  });
});

describe("channel mix", () => {
  const order = (d: string | null, c: string | null = null) => ({
    snapshot: d ? { dining_option: d } : null,
    channel: c,
  });

  it("returns nothing at all when nothing was rung", () => {
    // Not a set of zero-percent segments — a bar of nothing is a picture of
    // nothing, and the caller writes a sentence instead.
    expect(channelMix([])).toEqual([]);
  });

  it("drops empty buckets rather than drawing five slivers of zero", () => {
    const mix = channelMix([order("dine_in"), order("dine_in"), order("takeout")]);
    expect(mix.map((c) => c.key)).toEqual(["dine_in", "takeout"]);
    expect(mix[0].count).toBe(2);
  });

  it("rounds so the segments add to exactly 100", () => {
    // Three equal shares rounded independently give 33/33/33 and a segmented bar
    // with a gap on the end that reads as a rendering fault.
    const mix = channelMix([order("dine_in"), order("takeout"), order("delivery")]);
    expect(mix.reduce((s, c) => s + c.pct, 0)).toBe(100);
  });

  it("orders ties the way a restaurant says them, and stably", () => {
    // Two channels of equal size must not swap places between renders, and
    // dine-in before takeout before delivery is the order a person recites.
    const a = channelMix([order("delivery"), order("dine_in")]);
    const b = channelMix([order("dine_in"), order("delivery")]);
    expect(a.map((c) => c.key)).toEqual(["dine_in", "delivery"]);
    expect(a.map((c) => c.key)).toEqual(b.map((c) => c.key));
  });

  it("counts orders, not money, so a $6 coffee is one order like any other", () => {
    const mix = channelMix([order("dine_in"), order("dine_in"), order("delivery")]);
    expect(mix.find((c) => c.key === "dine_in")?.count).toBe(2);
    expect(mix.find((c) => c.key === "delivery")?.count).toBe(1);
  });
});
