import { describe, it, expect } from "vitest";
import { chitJob, receiptJob, renderPlainText } from "../../mobile/src/lib/printing/format";

// The native Register's chit/receipt formatters (pure — the basis a Star/Epson
// driver expands into ESC/POS). Locks the content that prints on fire + reprint.

describe("chitJob", () => {
  const job = chitJob({
    label: "Table 5",
    stationName: "Grill",
    firedAt: "2026-07-15T18:30:00Z",
    items: [
      { name: "Burger (+ Rare)", quantity: 2, seat: 1, allergy: "peanuts", note: "no onion" },
      { name: "Fries", quantity: 1, seat: null },
    ],
  });
  const text = renderPlainText(job);

  it("headers the table + station and lists each item with qty", () => {
    expect(text).toContain("Table 5");
    expect(text).toContain("GRILL");
    expect(text).toContain("2x  Burger (+ Rare)");
    expect(text).toContain("1x  Fries");
  });

  it("shows the seat and shouts the allergy", () => {
    expect(text).toContain("[S1]");
    expect(text).toContain("** ALLERGY: PEANUTS **");
    expect(text).toContain("- no onion");
  });

  it("uses 80mm kitchen paper by default", () => {
    expect(job.width).toBe(80);
    expect(job.lines.some((l) => l.kind === "cut")).toBe(true);
  });
});

describe("receiptJob", () => {
  const job = receiptJob({
    businessName: "Aathy Bistro",
    saleNumber: 46,
    createdAt: "2026-07-11T20:00:00Z",
    items: [{ name: "Pizza", quantity: 1, unitPrice: 16 }],
    subtotal: 16,
    discount: 2,
    tax: 1.82,
    tip: 3,
    total: 18.82,
    payments: [{ method: "card", amount: 18.82 }],
    footer: "Thank you!",
  });
  const text = renderPlainText(job);

  it("shows business, sale number, items and a two-column total", () => {
    expect(text).toContain("Aathy Bistro");
    expect(text).toContain("Sale #46");
    expect(text).toMatch(/1x Pizza\s+\$16\.00/);
    expect(text).toMatch(/TOTAL\s+\$18\.82/);
    expect(text).toMatch(/Discount\s+-\$2\.00/);
    expect(text).toContain("card");
    expect(text).toContain("Thank you!");
  });

  it("defaults to 58mm receipt paper", () => {
    expect(job.width).toBe(58);
  });
});

describe("renderPlainText columns", () => {
  it("right-aligns the price within the paper width", () => {
    const job = receiptJob({ businessName: "X", saleNumber: 1, createdAt: "2026-07-15T00:00:00Z", items: [], subtotal: 5, tax: 0, total: 5 });
    for (const line of renderPlainText(job).split("\n")) {
      expect(line.length).toBeLessThanOrEqual(32); // 58mm => 32 cols
    }
  });
});
