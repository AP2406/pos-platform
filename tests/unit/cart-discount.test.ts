import { describe, it, expect } from "vitest";
import { cartReducer, lineDiscountAmount, lineEffectiveTotal, lineEffectiveUnit, cartSubtotal, type CartLine, type CartState } from "../../mobile/src/state/cart";

// Per-item discount math + the free-text modifier reducer (order-shaping; no money).

function line(over: Partial<CartLine> = {}): CartLine {
  return { id: "l1", catalogItemId: "c", variationId: null, name: "Burger", unitPrice: 12, quantity: 2, seat: null, course: 1, note: null, modifiers: null, allergy: null, discount: null, customized: false, firedQty: 0, ...over };
}
function state(lines: CartLine[]): CartState {
  return { lines, activeSeat: null, diningOption: "dine_in", seatNames: {}, seq: 1 };
}

describe("line discount math", () => {
  it("percent + amount, capped at the line value", () => {
    expect(lineDiscountAmount(line({ discount: { kind: "percent", value: 10 } }))).toBe(2.4); // 10% of 24
    expect(lineDiscountAmount(line({ discount: { kind: "amount", value: 5 } }))).toBe(5);
    expect(lineDiscountAmount(line({ discount: { kind: "amount", value: 100 } }))).toBe(24); // capped at gross
    expect(lineDiscountAmount(line())).toBe(0);
  });

  it("effective total + per-unit price (what /quote taxes)", () => {
    const l = line({ discount: { kind: "percent", value: 10 } });
    expect(lineEffectiveTotal(l)).toBe(21.6);
    expect(lineEffectiveUnit(l)).toBe(10.8);
    expect(lineEffectiveTotal(line({ discount: { kind: "amount", value: 100 } }))).toBe(0); // never negative
  });

  it("cartSubtotal sums discounted line totals", () => {
    const s = state([line({ id: "a", discount: { kind: "amount", value: 4 } }), line({ id: "b", unitPrice: 5, quantity: 1 })]);
    expect(cartSubtotal(s)).toBe(20 + 5); // (24-4) + 5
  });
});

describe("cartReducer discount + free-text modifier", () => {
  it("SET_LINE_DISCOUNT sets and clears", () => {
    let s = state([line()]);
    s = cartReducer(s, { type: "SET_LINE_DISCOUNT", id: "l1", discount: { kind: "percent", value: 15 } });
    expect(s.lines[0].discount).toEqual({ kind: "percent", value: 15 });
    s = cartReducer(s, { type: "SET_LINE_DISCOUNT", id: "l1", discount: null });
    expect(s.lines[0].discount).toBeNull();
  });

  it("ADD_LINE_MODIFIER folds price into unit_price, appends the name + a structured modifier", () => {
    let s = state([line()]);
    s = cartReducer(s, { type: "ADD_LINE_MODIFIER", id: "l1", name: "extra hot", price: 1.5 });
    const l = s.lines[0];
    expect(l.unitPrice).toBe(13.5);
    expect(l.name).toBe("Burger (+ extra hot)");
    expect(l.modifiers?.[0]).toMatchObject({ modifier_id: null, group_name: "Custom", name: "extra hot", price: 1.5 });
    expect(l.customized).toBe(true);
  });

  it("ignores an empty free-text modifier", () => {
    const s0 = state([line()]);
    const s1 = cartReducer(s0, { type: "ADD_LINE_MODIFIER", id: "l1", name: "  ", price: 0 });
    expect(s1).toBe(s0);
  });
});
