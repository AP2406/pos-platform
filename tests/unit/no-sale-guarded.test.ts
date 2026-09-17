import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS } from "@/lib/services/permissions";

// A NO-SALE OPENS THE CASH DRAWER WITH NO TRANSACTION BEHIND IT.
//
// It is the classic till-theft vector and the reason every POS audits it. In
// recordCashMovement it was the ONE cash movement that required no permission
// and no approval: the authorization block was wrapped in `if (kind !==
// "no_sale")`, so pay-in, pay-out and drop were gated and the drawer-opening
// one was not.
//
// The intent had been written down and never wired up — `no_sale` is a declared
// permission with its own label, a declared approval action in the config
// registry, and granted by default to owner / manager / shift_lead while being
// withheld from server and host. Every piece existed except the call.
//
// Structural, like debug-actions-guarded and signup-locked: what matters is
// that the check exists and is not skipped for this kind, and that cannot be
// asserted by calling the action without a Supabase session and a PIN.

const actions = readFileSync(join(process.cwd(), "app/app/pos/drawer/actions.ts"), "utf8");
const body = actions.slice(actions.indexOf("export async function recordCashMovement"));

describe("no-sale is authorized", () => {
  it("does not skip authorization for no_sale", () => {
    // The exact shape of the bug. If this substring comes back, so has the hole.
    expect(body).not.toContain('if (kind !== "no_sale") {\n    const auth');
  });

  it("picks a permission key from the kind rather than hardcoding one", () => {
    expect(body).toMatch(/permission[^=]*=\s*kind === "no_sale"\s*\?\s*"no_sale"\s*:\s*"open_drawer"/);
  });

  it("runs posAuthorize on every path through the function", () => {
    // Not inside any `if (kind !== ...)`.
    const gate = body.indexOf("posAuthorize");
    const insert = body.indexOf('from("cash_movements").insert');
    expect(gate).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(insert);
  });

  it("asks for approval with the same key it checked", () => {
    // Approving a no-sale with a PIN that only carries open_drawer would be a
    // quieter version of the same hole.
    expect(body).toMatch(/approverByPin\([^)]*permission\)/);
  });
});

describe("the permission this enforces", () => {
  it("exists as a real permission key", () => {
    expect(PERMISSION_KEYS).toContain("no_sale");
  });

  it("is withheld from the roles that should not open a till", () => {
    // This is what the gate is FOR. A server could open the drawer while the
    // permissions screen said they could not.
    expect(DEFAULT_ROLE_PERMISSIONS.server).not.toContain("no_sale");
    expect(DEFAULT_ROLE_PERMISSIONS.host).not.toContain("no_sale");
    expect(DEFAULT_ROLE_PERMISSIONS.bookkeeper).not.toContain("no_sale");
  });

  it("is held by the roles that run a till", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.owner).toContain("no_sale");
    expect(DEFAULT_ROLE_PERMISSIONS.manager).toContain("no_sale");
    expect(DEFAULT_ROLE_PERMISSIONS.shift_lead).toContain("no_sale");
  });

  it("is separate from open_drawer, which is why it gets its own check", () => {
    // They are separately grantable, so a no-sale borrowing open_drawer's key
    // would be wrong in both directions.
    expect(PERMISSION_KEYS).toContain("open_drawer");
    expect("no_sale").not.toBe("open_drawer");
  });
});
