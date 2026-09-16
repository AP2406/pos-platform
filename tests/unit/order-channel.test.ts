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
  // The defect, corrected
  // ---------------------------------------------------------------------
  //
  // These assertions used to pin the WRONG answers on purpose, so that whoever
  // fixed the classifier had to come and change them deliberately rather than
  // discover afterwards that /app/reports' channel table had moved. This is
  // that change. See docs/order-channel-correction.md for which figures shift.

  it("files every named delivery platform as Delivery", () => {
    // 0074 writes 'doordash' | 'ubereats' | 'grubhub' and normalises anything
    // it does not recognise to the literal 'delivery', so these four are the
    // complete set. Previously only the fallback landed, because the arm
    // matched by substring.
    expect(channelOf({ channel: "doordash" })).toBe("delivery");
    expect(channelOf({ channel: "ubereats" })).toBe("delivery");
    expect(channelOf({ channel: "grubhub" })).toBe("delivery");
    expect(channelOf({ channel: "delivery" })).toBe("delivery");
  });

  it("places kiosk, online and QR on the axis each one actually belongs to", () => {
    // Not all three into one bucket: they arrived differently AND they leave
    // differently. A kiosk check is togo (0071), an online order is collected
    // (0072, "an online pickup order"), and a QR check is someone sitting at a
    // table paying for themselves (0073).
    expect(channelOf({ channel: "kiosk" })).toBe("takeout");
    expect(channelOf({ channel: "online" })).toBe("pickup");
    expect(channelOf({ channel: "qr" })).toBe("dine_in");
  });

  it("lets a delivery platform outrank the register's dining option", () => {
    // These are the two axes disagreeing. A DoorDash order is a delivery no
    // matter what the check was flagged as on the way out.
    expect(channelOf({ channel: "doordash", snapshot: { dining_option: "takeout" } }))
      .toBe("delivery");
  });

  it("is case- and whitespace-insensitive about the column", () => {
    // orders.channel is plain text with no enum and no CHECK constraint.
    expect(channelOf({ channel: "DoorDash" })).toBe("delivery");
    expect(channelOf({ channel: " kiosk " })).toBe("takeout");
  });

  it("does not match on substrings", () => {
    // The original defect was the mirror of this: 'doordash' failed to match
    // because the test was `includes("delivery")`. Guard the other direction
    // too, so a future slug that merely contains a keyword is not swept up.
    expect(channelOf({ channel: "delivery-pending-cancellation" })).toBe("in_store");
    expect(channelOf({ channel: "takeout-window" })).toBe("in_store");
  });

  it("KNOWN GAP: an unrecognised channel still reads as In-store", () => {
    // Deliberate, not forgotten. There is no "other" bucket that would not
    // change the shape of the report's table. Whoever adds the next ordering
    // surface has to add its slug to the map — this test is the reminder.
    expect(channelOf({ channel: "whatsapp" })).toBe("in_store");
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
