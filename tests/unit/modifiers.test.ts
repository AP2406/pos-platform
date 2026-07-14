import { describe, it, expect } from "vitest";
import {
  toggleMod,
  requiredUnmet,
  activeGroups,
  buildLine,
  itemNeedsSheet,
  type ModifierGroup,
} from "../../mobile/src/lib/modifiers";

// The native Register's forced-modifier engine (ported from the web POS). These
// lock down the enforcement rules that gate Send-to-kitchen: required minimums,
// max-select caps, single-select replace, nested follow-up groups, and pricing.

const opt = (id: string, name: string, price = 0, child_group?: ModifierGroup) => ({ id, name, price, child_group });

// A pizza: required single-select size handled via variations; a required "Sauce"
// (choose 1), an optional "Toppings" (max 3, split-enabled) whose "Meat Combo"
// option opens a required follow-up "Pick a meat".
const meatGroup: ModifierGroup = {
  id: "g-meat",
  name: "Pick a meat",
  required: true,
  min_select: 1,
  max_select: 1,
  allow_split: false,
  options: [opt("m-beef", "Beef"), opt("m-pork", "Pork")],
};
const sauce: ModifierGroup = { id: "g-sauce", name: "Sauce", required: true, min_select: 0, max_select: 1, allow_split: false, options: [opt("s-red", "Red"), opt("s-white", "White")] };
const toppings: ModifierGroup = {
  id: "g-top",
  name: "Toppings",
  required: false,
  min_select: 0,
  max_select: 3,
  allow_split: true,
  options: [opt("t-mush", "Mushroom", 1.5), opt("t-onion", "Onion", 1), opt("t-oli", "Olives", 1), opt("t-combo", "Meat Combo", 3, meatGroup)],
};
const item = {
  id: "pizza",
  name: "Pizza",
  price: 12,
  variations: [{ id: "sm", name: "Small", price: 10 }, { id: "lg", name: "Large", price: 16 }],
  modifierGroups: [sauce, toppings],
};

describe("requiredUnmet", () => {
  it("flags a required group with nothing chosen (required forces min 1 even at min_select 0)", () => {
    const unmet = requiredUnmet(item.modifierGroups, []);
    expect(unmet.map((g) => g.id)).toContain("g-sauce");
  });

  it("clears once the required group is satisfied", () => {
    const unmet = requiredUnmet(item.modifierGroups, ["s-red"]);
    expect(unmet.map((g) => g.id)).not.toContain("g-sauce");
  });

  it("surfaces a nested required group only after its parent option is picked", () => {
    expect(activeGroups(item.modifierGroups, ["s-red"]).map((g) => g.id)).not.toContain("g-meat");
    const withCombo = ["s-red", "t-combo"];
    expect(activeGroups(item.modifierGroups, withCombo).map((g) => g.id)).toContain("g-meat");
    // Combo chosen but no meat yet → still unmet.
    expect(requiredUnmet(item.modifierGroups, withCombo).map((g) => g.id)).toContain("g-meat");
    expect(requiredUnmet(item.modifierGroups, [...withCombo, "m-beef"]).map((g) => g.id)).not.toContain("g-meat");
  });
});

describe("toggleMod", () => {
  it("single-select replaces the prior choice", () => {
    const a = toggleMod(item.modifierGroups, [], "s-red");
    const b = toggleMod(item.modifierGroups, a, "s-white");
    expect(b).toEqual(["s-white"]);
  });

  it("blocks a selection past the group max", () => {
    let sel = ["t-mush", "t-onion", "t-oli"]; // 3 of max 3
    sel = toggleMod(item.modifierGroups, sel, "t-combo");
    expect(sel).not.toContain("t-combo");
    expect(sel).toHaveLength(3);
  });

  it("deselecting a parent clears its follow-up subtree", () => {
    const sel = ["t-combo", "m-beef"];
    const next = toggleMod(item.modifierGroups, sel, "t-combo");
    expect(next).not.toContain("m-beef");
    expect(next).not.toContain("t-combo");
  });
});

describe("buildLine", () => {
  it("prices variation + modifiers and labels half placement", () => {
    const line = buildLine(item, "lg", ["s-red", "t-mush"], { "t-mush": "left" });
    // Large 16 + mushroom 1.5 = 17.5
    expect(line.unitPrice).toBe(17.5);
    expect(line.variationId).toBe("lg");
    expect(line.name).toContain("Large");
    expect(line.name).toContain("½L Mushroom");
    expect(line.modifiers.find((m) => m.modifier_id === "t-mush")?.position).toBe("left");
  });
});

describe("itemNeedsSheet", () => {
  it("forces the picker for items with variations or groups", () => {
    expect(itemNeedsSheet(item)).toBe(true);
    expect(itemNeedsSheet({ variations: [], modifierGroups: [] })).toBe(false);
  });
});
