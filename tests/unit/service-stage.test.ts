import { describe, it, expect } from "vitest";
import { kitchenStateByElement, serviceStage } from "../../mobile/src/lib/service-stage";
import { formatDuration } from "../../mobile/src/lib/format";
import type { KitchenTicket } from "../../mobile/src/lib/reads";

// Floor v2 service-lifecycle derivation + uncapped duration. Money-independent
// (reads only): stage comes from the open ticket + its kitchen tickets.

const kt = (over: Partial<KitchenTicket>): KitchenTicket => ({
  id: "k",
  label: null,
  items: [],
  firedAt: "2026-01-01T00:00:00Z",
  fulfilledAt: null,
  stationId: null,
  courseId: null,
  rush: false,
  elementId: "E1",
  ...over,
});

describe("kitchenStateByElement", () => {
  it("counts open vs bumped tickets per element, ignoring element-less tickets", () => {
    const m = kitchenStateByElement([
      kt({ elementId: "E1", fulfilledAt: null }),
      kt({ elementId: "E1", fulfilledAt: "2026-01-01T00:10:00Z" }),
      kt({ elementId: "E2", fulfilledAt: "2026-01-01T00:10:00Z" }),
      kt({ elementId: null }), // delivery/togo — no table key
    ]);
    expect(m.E1).toEqual({ open: 1, done: 1 });
    expect(m.E2).toEqual({ open: 0, done: 1 });
    expect(Object.keys(m)).not.toContain("null");
  });
});

describe("serviceStage", () => {
  const state = kitchenStateByElement([
    kt({ elementId: "SENT", fulfilledAt: null }),
    kt({ elementId: "READY", fulfilledAt: "2026-01-01T00:10:00Z" }),
  ]);

  it("pay wins whenever the check is dropped", () => {
    expect(serviceStage({ checkDropped: true, elementId: "SENT" }, state)).toBe("pay");
  });
  it("open = seated with nothing fired", () => {
    expect(serviceStage({ checkDropped: false, elementId: "OPEN" }, state)).toBe("open");
  });
  it("sent = at least one ticket still cooking", () => {
    expect(serviceStage({ checkDropped: false, elementId: "SENT" }, state)).toBe("sent");
  });
  it("ready = all fired tickets bumped", () => {
    expect(serviceStage({ checkDropped: false, elementId: "READY" }, state)).toBe("ready");
  });
  it("a non-table check can only resolve to open/pay", () => {
    expect(serviceStage({ checkDropped: false, elementId: null }, state)).toBe("open");
    expect(serviceStage({ checkDropped: true, elementId: null }, state)).toBe("pay");
  });
});

describe("formatDuration", () => {
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  it("shows minutes under an hour, uncapped hours beyond — never 24h+", () => {
    expect(formatDuration("2026-01-01T00:00:00Z", base + 18 * 60000)).toBe("18 min");
    expect(formatDuration("2026-01-01T00:00:00Z", base + 65 * 60000)).toBe("1h 05m");
    expect(formatDuration("2026-01-01T00:00:00Z", base + 26 * 60 * 60000)).toBe("26h 00m");
  });
});
