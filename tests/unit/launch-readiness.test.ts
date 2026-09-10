import { describe, it, expect } from "vitest";
import {
  evaluateReadiness,
  taxRatePercent,
  type ReadinessFacts,
} from "@/lib/services/launch-readiness";

// These rules used to live inline in the go-live page. They now feed two
// screens, so the thing worth pinning is that both get the same answer — and
// that lifting them didn't quietly change what "ready" means for the merchants
// who are already live.

const blank: ReadinessFacts = {
  name: "",
  defaultTaxRate: 0,
  finixMerchantState: null,
  goLive: null,
  activeItemCount: 0,
  drawerSessionCount: 0,
};

const live: ReadinessFacts = {
  name: "Sunny Side Diner",
  defaultTaxRate: 0.13,
  finixMerchantState: "APPROVED",
  goLive: { legal_accepted: true },
  activeItemCount: 42,
  drawerSessionCount: 6,
};

describe("what a brand-new business sees", () => {
  it("is not ready, and says exactly how much is left", () => {
    const r = evaluateReadiness(blank);
    expect(r.ready).toBe(false);
    expect(r.requiredTotal).toBe(5);
    expect(r.requiredDone).toBe(0);
    expect(r.outstanding).toHaveLength(5);
  });

  it("gives every outstanding item somewhere to go", () => {
    for (const c of evaluateReadiness(blank).outstanding) {
      expect(c.href.startsWith("/app/"), c.id).toBe(true);
      expect(c.detail.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe("what a live business sees", () => {
  it("is ready, with nothing outstanding", () => {
    const r = evaluateReadiness(live);
    expect(r.ready).toBe(true);
    expect(r.outstanding).toHaveLength(0);
    expect(r.requiredDone).toBe(r.requiredTotal);
  });

  it("counts business basics but never lets it block going live", () => {
    // The go-live page has always shown this row without gating on it. Making
    // it required here would have blocked merchants who are already selling.
    const basics = evaluateReadiness(live).checks.find((c) => c.id === "basics");
    expect(basics?.required).toBe(false);
  });
});

describe("the two ways a merchant opts out", () => {
  it("tax-free confirmation stands in for a tax rate", () => {
    const r = evaluateReadiness({ ...blank, goLive: { tax_free: true } });
    expect(r.checks.find((c) => c.id === "tax")?.done).toBe(true);
  });

  it("cash-only confirmation stands in for card approval", () => {
    const r = evaluateReadiness({ ...blank, goLive: { cash_only: true } });
    expect(r.checks.find((c) => c.id === "payments")?.done).toBe(true);
  });

  it("only an APPROVED merchant state counts as cards being live", () => {
    for (const state of ["PENDING", "PROVISIONING", "REJECTED", "", null]) {
      const r = evaluateReadiness({ ...blank, finixMerchantState: state });
      expect(r.checks.find((c) => c.id === "payments")?.done, String(state)).toBe(false);
    }
    // Case shouldn't decide whether a restaurant can take cards.
    const ok = evaluateReadiness({ ...blank, finixMerchantState: "approved" });
    expect(ok.checks.find((c) => c.id === "payments")?.done).toBe(true);
  });

  it("treats a null or junk go_live blob as nothing confirmed", () => {
    for (const g of [null, undefined, "yes", 7, []]) {
      const r = evaluateReadiness({ ...blank, goLive: g });
      expect(r.checks.find((c) => c.id === "legal")?.done, String(g)).toBe(false);
    }
  });
});

describe("the tax rate is stored two ways and both mean the same thing", () => {
  it("reads a fraction and a percent identically", () => {
    expect(taxRatePercent(0.13)).toBeCloseTo(13);
    expect(taxRatePercent(13)).toBe(13);
    expect(taxRatePercent("0.13")).toBeCloseTo(13);
  });

  it("treats absent, zero and junk as no rate set", () => {
    expect(taxRatePercent(null)).toBe(0);
    expect(taxRatePercent(undefined)).toBe(0);
    expect(taxRatePercent(0)).toBe(0);
    expect(taxRatePercent("abc")).toBe(0);
    expect(taxRatePercent(-1)).toBe(0);
  });

  it("does not let a stored rate of zero pass the tax check on its own", () => {
    expect(evaluateReadiness({ ...blank, defaultTaxRate: 0 }).checks
      .find((c) => c.id === "tax")?.done).toBe(false);
  });
});

describe("the register check", () => {
  it("passes on any drawer session ever opened, not just an open one", () => {
    // A restaurant that closed out last night is still ready this morning.
    const r = evaluateReadiness({ ...blank, drawerSessionCount: 1 });
    expect(r.checks.find((c) => c.id === "register")?.done).toBe(true);
  });
});
