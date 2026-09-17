import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { restrictedLabel } from "@/lib/services/restricted-items";

// A CATALOG ITEM FLAGGED requires_manager_approval MUST NOT BE RUNG WITHOUT ONE.
//
// It was enforced in the browser only. register-client shows a manager-PIN modal
// before adding such an item; createOrder's approval gate — the block commented
// "Server-side approval gate (P0 security)" — checked discount, comp, line void,
// tax exemption and service-charge waive, and never looked at whether the cart
// contained a restricted item at all.
//
// A client gate is not a gate, for the same reason app/app/debug/guard.ts
// exists: a server action is a POST to a build-time id that ships in the client
// bundle, so anything only the browser refuses can be asked for directly. The
// flag exists to stop a cashier ringing a controlled item — a high-value bottle,
// a comped staff meal, a gift card — without a manager, and that is exactly the
// person with a reason to bypass it.

const order = readFileSync(join(process.cwd(), "app/app/pos/actions.ts"), "utf8");
const split = readFileSync(join(process.cwd(), "app/app/pos/split-actions.ts"), "utf8");
const helper = readFileSync(join(process.cwd(), "lib/services/restricted-items.ts"), "utf8");

describe("both order paths check for manager-only items", () => {
  it("createOrder looks them up", () => {
    expect(order).toContain("restrictedItemNames");
  });

  it("the split path looks them up too", () => {
    // A split check carries the same lines and was equally unguarded.
    expect(split).toContain("restrictedItemNames");
  });

  for (const [name, src] of [["createOrder", order], ["split", split]] as const) {
    it(`${name} looks them up BEFORE the approval gate runs`, () => {
      const lookup = src.indexOf("restrictedItemNames(");
      const gate = src.indexOf("verifyInSaleApprovals({");
      expect(lookup).toBeGreaterThan(-1);
      expect(gate).toBeGreaterThan(-1);
      expect(lookup).toBeLessThan(gate);
    });

    it(`${name} passes them INTO the gate as a sensitive action`, () => {
      // Looking them up and not acting on it would be the same bug with extra
      // steps.
      expect(src).toMatch(/present:\s*\w*[Rr]estricted\w*\.length > 0/);
    });

    it(`${name} treats it as a manager-role action`, () => {
      // permKey null = manager or owner may ring it, anyone else needs a manager
      // PIN — the same semantics the client modal implements.
      const idx = src.search(/present:\s*\w*[Rr]estricted\w*\.length > 0/);
      expect(src.slice(idx, idx + 220)).toContain("permKey: null");
    });
  }
});

describe("the lookup fails closed", () => {
  it("returns a blocking value when the query errors", () => {
    // A gate that opens because the database hiccupped is not a gate. The cost
    // of being wrong this way is a manager typing a PIN they did not need to.
    const c = helper.slice(helper.indexOf("if (error)"));
    expect(c).toContain("could not verify");
    expect(c).not.toMatch(/if \(error\)[\s\S]{0,200}return \[\];/);
  });

  it("skips the query entirely for a cart with no catalog items", () => {
    expect(helper).toContain("if (ids.length === 0) return [];");
  });
});

describe("what the cashier is told", () => {
  it("names the item, so they know which line to pull", () => {
    // "A manager PIN is required to approve: restricted item" tells a cashier
    // nothing about what to do next.
    expect(restrictedLabel(["Macallan 18"])).toBe("manager-only item: Macallan 18");
  });

  it("lists a few and counts the rest rather than printing a wall", () => {
    const s = restrictedLabel(["A", "B", "C", "D", "E"]);
    expect(s).toContain("A, B, C");
    expect(s).toContain("+2 more");
  });

  it("still says something useful when it has no names", () => {
    expect(restrictedLabel([])).toBe("restricted item");
  });
});
