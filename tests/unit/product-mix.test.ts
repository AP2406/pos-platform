import { describe, it, expect } from "vitest";
import { aggregateItemSales } from "@/lib/services/product-mix";

// The product-mix roll-up used by BOTH /app/reports and the admin home's
// top-selling table. These tests exist because the two screens are now required
// to agree: the whole reason this function was lifted out of the reports page is
// that a second implementation would have drifted, and the properties below are
// the ones a drift would show up in first.

describe("item sales aggregate", () => {
  it("collapses the split-check suffix so one item is one row", () => {
    // A busy Friday of split tables would otherwise push every popular item out
    // of a top-four list, as two half-sized rows each.
    const rows = aggregateItemSales([
      { catalog_item_id: null, name: "Burger", unit_price: 18, quantity: 1 },
      { catalog_item_id: null, name: "Burger (shared)", unit_price: 9, quantity: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Burger");
    expect(rows[0].qty).toBe(2);
    expect(rows[0].revenue).toBe(27);
  });

  it("keys on the catalog id, so a renamed item stays one row", () => {
    const rows = aggregateItemSales([
      { catalog_item_id: "abc", name: "Flat white", unit_price: 5, quantity: 2 },
      { catalog_item_id: "abc", name: "Flat White", unit_price: 5, quantity: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(3);
    expect(rows[0].catalogItemId).toBe("abc");
  });

  it("keys a one-off line on its name, because it has no catalog row", () => {
    const rows = aggregateItemSales([
      { catalog_item_id: null, name: "Corkage", unit_price: 15, quantity: 1 },
      { catalog_item_id: null, name: "Corkage", unit_price: 15, quantity: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(2);
    expect(rows[0].catalogItemId).toBeNull();
  });

  it("does not merge a custom line into a catalog item of the same name", () => {
    // They are two different things that happen to share a label, and merging
    // them would attribute untracked money to a tracked item.
    const rows = aggregateItemSales([
      { catalog_item_id: "abc", name: "Wine", unit_price: 12, quantity: 1 },
      { catalog_item_id: null, name: "Wine", unit_price: 40, quantity: 1 },
    ]);
    expect(rows).toHaveLength(2);
  });

  it("sorts by revenue, not by quantity", () => {
    // The card's job is "what earns", not "what moves". A 50-cent side that
    // sells a hundred is not the top seller.
    const rows = aggregateItemSales([
      { catalog_item_id: "side", name: "Side of fries", unit_price: 0.5, quantity: 100 },
      { catalog_item_id: "steak", name: "Ribeye", unit_price: 48, quantity: 3 },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Ribeye", "Side of fries"]);
  });

  it("breaks a revenue tie by first-seen order, stably", () => {
    // Two items that sold the identical amount must not swap rows between two
    // loads of the same page. This was previously an accident of Object.keys
    // iteration order; it is a promise now.
    const lines = [
      { catalog_item_id: "a", name: "A", unit_price: 10, quantity: 1 },
      { catalog_item_id: "b", name: "B", unit_price: 10, quantity: 1 },
    ];
    expect(aggregateItemSales(lines).map((r) => r.name)).toEqual(["A", "B"]);
    expect(aggregateItemSales([...lines]).map((r) => r.name)).toEqual(["A", "B"]);
  });

  it("survives the nulls PostgREST actually returns", () => {
    // Not defensive padding: unit_price is numeric and comes back as a string
    // often enough, and a voided-to-zero line has a real quantity.
    const rows = aggregateItemSales([
      { catalog_item_id: null, name: null, unit_price: null, quantity: null },
      { catalog_item_id: "x", name: "Tea", unit_price: "3.50", quantity: "2" },
    ]);
    const tea = rows.find((r) => r.name === "Tea");
    expect(tea?.revenue).toBe(7);
    expect(rows.every((r) => Number.isFinite(r.revenue))).toBe(true);
  });

  it("returns nothing for no lines, rather than a row of zeroes", () => {
    expect(aggregateItemSales([])).toEqual([]);
  });
});
