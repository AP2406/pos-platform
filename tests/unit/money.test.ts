import { describe, it, expect } from "vitest";
import {
  formatMoney,
  currencyDecimals,
  minorUnits,
  cashSuggestions,
  cashNotes,
  SUPPORTED_CURRENCIES,
} from "@surge/api-contracts";

// Surge stored businesses.currency, offered a picker for it, and then the till
// ignored it: the register never referenced currency at all, the receipt was
// `"$" + n.toFixed(2)`, and the cash pad offered $20/$50/$100 as hardcoded
// integers. These tests are the boundary that stops that coming back.

describe("formatting", () => {
  it("uses the symbol the merchant's own menu uses", () => {
    // The DEFAULT Intl display renders CAD as "CA$85.81", which is right on an
    // accounting export and wrong on a till in Canada where every price in the
    // room says "$". narrowSymbol is the one to use.
    expect(formatMoney(85.81, "CAD")).toBe("$85.81");
    expect(formatMoney(85.81, "USD")).toBe("$85.81");
  });

  it("formats the currency the pilot is actually for", () => {
    expect(formatMoney(85.81, "LKR")).toBe("Rs 85.81");
  });

  it("separates the symbol with a PLAIN space, not a non-breaking one", () => {
    // Intl uses U+00A0 (and sometimes U+202F) between a multi-character symbol
    // and the number. Correct typography, and a liability: this string is
    // printed on thermal receipts, and a printer that does not know U+00A0
    // puts a black box in the middle of the total. Caught by this test failing
    // with two strings that looked identical in the diff.
    const s = formatMoney(85.81, "LKR");
    expect(s).not.toMatch(/[  ]/);
    expect(s.charCodeAt(2)).toBe(32);
  });

  it("handles a zero-decimal currency without inventing cents", () => {
    expect(formatMoney(86, "JPY")).toBe("¥86");
    expect(currencyDecimals("JPY")).toBe(0);
    expect(minorUnits("JPY")).toBe(1);
  });

  it("knows ordinary currencies have two decimals and a hundred minor units", () => {
    expect(currencyDecimals("CAD")).toBe(2);
    expect(minorUnits("CAD")).toBe(100);
    expect(minorUnits("LKR")).toBe(100);
  });

  it("defaults to CAD rather than throwing when nothing is passed", () => {
    expect(formatMoney(5)).toBe("$5.00");
  });

  it("prints a number rather than throwing on an unknown code", () => {
    // This runs inside a render. Throwing here takes the register down mid
    // service, which is a worse outcome than an ugly string.
    expect(formatMoney(12.5, "ZZZ")).toContain("12.50");
    expect(() => formatMoney(12.5, "ZZZ")).not.toThrow();
  });

  it("treats junk amounts as zero instead of rendering NaN on a bill", () => {
    expect(formatMoney(Number.NaN, "CAD")).toBe("$0.00");
    expect(formatMoney(undefined as unknown as number, "CAD")).toBe("$0.00");
  });
});

describe("quick cash suggestions", () => {
  it("reproduces TouchBistro's buttons for the same bill", () => {
    // Their $85.81 check offers Exact / $86 / $90 / $100. We arrive at 86, 90
    // and 100 from the note values rather than from a hardcoded list, which is
    // the whole point — it stays right in a currency they never considered.
    expect(cashSuggestions(85.81, "CAD")).toEqual([86, 90, 100]);
  });

  it("offers the next-dollar-up our old version skipped", () => {
    // buildQuickAmounts rounded to the next $5 and $10 and then offered flat
    // $20/$50/$100, so an 85.81 bill never suggested 86 — the single most
    // common cash rounding there is.
    expect(cashSuggestions(85.81, "CAD")[0]).toBe(86);
  });

  it("is sensible in rupees, where the old hardcoded list was absurd", () => {
    // The old candidates were 2000/5000/10000 CENTS — 20, 50 and 100 rupees.
    // On a 3,480 rupee bill all three are SMALLER than the total, so the pad
    // would have shown three buttons that cannot settle the check.
    const s = cashSuggestions(3480, "LKR");
    expect(s.every((v) => v > 3480)).toBe(true);
    expect(s).toEqual([3500, 4000, 5000]);
  });

  it("never suggests an amount that cannot pay the bill", () => {
    for (const cur of ["CAD", "LKR", "GBP", "INR", "JPY"]) {
      for (const total of [0.5, 7.25, 85.81, 3480, 12999]) {
        for (const v of cashSuggestions(total, cur)) {
          expect(v).toBeGreaterThan(total);
        }
      }
    }
  });

  it("excludes the total itself, which the caller renders as Exact", () => {
    // A button labelled "$90.00" beside one labelled "Exact" is the same
    // button twice.
    expect(cashSuggestions(90, "CAD")).not.toContain(90);
  });

  it("returns nothing for an empty or nonsense total", () => {
    expect(cashSuggestions(0, "CAD")).toEqual([]);
    expect(cashSuggestions(-5, "CAD")).toEqual([]);
    expect(cashSuggestions(Number.NaN, "CAD")).toEqual([]);
  });

  it("gives distinct values, so the pad never shows the same note twice", () => {
    for (const total of [1, 9.99, 20, 85.81, 101]) {
      const s = cashSuggestions(total, "CAD");
      expect(new Set(s).size).toBe(s.length);
    }
  });

  it("does not leave floating-point dust on a button", () => {
    // 0.1 + 0.2 arithmetic on money produces 90.00000000000001, which renders
    // as a button nobody will press.
    for (const v of cashSuggestions(29.7, "CAD")) {
      expect(Number.isInteger(v * 100)).toBe(true);
    }
  });

  it("falls back to a generic ladder for a currency we have no notes for", () => {
    expect(cashNotes("XYZ")).toEqual([1, 5, 10, 20, 50, 100]);
    expect(cashSuggestions(7.25, "XYZ")).toEqual([8, 10, 20]);
  });
});

describe("the picker", () => {
  it("offers more than two North American currencies", () => {
    // It was ["CAD", "USD"] in a product positioned for operators anywhere.
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(2);
  });

  it("includes the currency of the pilot we are about to run", () => {
    expect(SUPPORTED_CURRENCIES).toContain("LKR");
  });

  it("can format every currency it offers", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(() => formatMoney(1234.5, c)).not.toThrow();
      expect(formatMoney(1234.5, c).length).toBeGreaterThan(0);
    }
  });

  it("has note denominations for every currency it offers", () => {
    // Otherwise a merchant selects their currency and silently gets the dollar
    // ladder on the cash pad. 137.4 rather than 100 on purpose — see below.
    for (const c of SUPPORTED_CURRENCIES) {
      expect(cashNotes(c).length).toBeGreaterThan(0);
      expect(cashSuggestions(137.4, c).length).toBeGreaterThan(0);
    }
  });

  it("offers nothing extra when the total IS a note, which is correct", () => {
    // A bill of exactly $100 divides evenly into every note we know, so every
    // rounding-up lands back on 100 and none of them is more than the total.
    // The pad shows "Exact" and nothing else, which is the right answer — the
    // guest hands over a hundred. Written down because an empty row looks like
    // a bug until you think about it, and the first version of this test
    // asserted the opposite.
    expect(cashSuggestions(100, "CAD")).toEqual([]);
    expect(cashSuggestions(20, "CAD")).toEqual([50, 100]);
  });
});
