import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// The register's authorization question is "what may this CASHIER do", answered
// from the signed PIN cookie — not "what may this web login do". These tests
// pin the resolution order and, above all, that a missing PIN session refuses
// instead of skipping the check, which is what the old
// `if (active && !actorCan(...))` shape did.

const cookieGet = vi.fn();
const readActiveStaffId = vi.fn();
const staffPermissionsById = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));
vi.mock("@/lib/services/active-staff-cookie", () => ({
  ACTIVE_STAFF_COOKIE: "surge_active_staff",
  readActiveStaffId: (v: unknown, b: string) => readActiveStaffId(v, b),
}));
vi.mock("@/lib/services/permissions-server", () => ({
  staffPermissionsById: (c: unknown, b: string, s: string) => staffPermissionsById(c, b, s),
}));

const { posAuthorize } = await import("@/lib/services/pos-action-guard");

const db = {} as SupabaseClient;
const BIZ = "biz-1";

/** A cashier signed in at the PIN pad holding `perms`. */
function pinnedAs(perms: string[]) {
  cookieGet.mockReturnValue({ value: "staff-1.sig" });
  readActiveStaffId.mockReturnValue("staff-1");
  staffPermissionsById.mockResolvedValue({
    staffId: "staff-1",
    name: "Sam",
    can: (p: string) => perms.includes(p),
  });
}

/** Nobody at the PIN pad. */
function noPinSession() {
  cookieGet.mockReturnValue(undefined);
  readActiveStaffId.mockReturnValue(null);
  staffPermissionsById.mockResolvedValue(null);
}

beforeEach(() => {
  cookieGet.mockReset();
  readActiveStaffId.mockReset();
  staffPermissionsById.mockReset();
});

describe("with a PIN session, the staff matrix decides", () => {
  it("allows a cashier who holds the permission, with no approval needed", async () => {
    pinnedAs(["open_drawer", "void"]);
    const res = await posAuthorize(db, BIZ, "staff", "open_drawer");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pinned).toBe(true);
      expect(res.needsApproval).toBe(false);
      expect(res.actor).toMatchObject({ kind: "staff", staffId: "staff-1", name: "Sam" });
    }
  });

  it("asks for approval — not a refusal — when the cashier lacks it", async () => {
    pinnedAs([]);
    const res = await posAuthorize(db, BIZ, "staff", "open_drawer");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.needsApproval).toBe(true);
  });

  it("uses the cashier's permissions, not the web role's", async () => {
    // A server at the till who has been granted void by a custom role can void,
    // even though the device is signed in under a low-privilege web member.
    pinnedAs(["void"]);
    const res = await posAuthorize(db, BIZ, "trainee", "void");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.needsApproval).toBe(false);
  });

  it("ignores a cookie whose signature does not verify", async () => {
    cookieGet.mockReturnValue({ value: "staff-9.forged" });
    readActiveStaffId.mockReturnValue(null); // signature check failed
    const res = await posAuthorize(db, BIZ, "staff", "open_drawer");
    // Falls through to the web role, which for staff does not hold open_drawer.
    expect(res.ok).toBe(false);
    expect(staffPermissionsById).not.toHaveBeenCalled();
  });
});

describe("with no PIN session, the web role decides — it is not skipped", () => {
  it("refuses a member whose role lacks the permission", async () => {
    noPinSession();
    for (const role of ["staff", "trainee", "bookkeeper"]) {
      const res = await posAuthorize(db, BIZ, role, "open_drawer");
      expect(res.ok, role).toBe(false);
    }
  });

  it("still lets an owner or manager run a non-staffed till", async () => {
    noPinSession();
    for (const role of ["owner", "manager"]) {
      const res = await posAuthorize(db, BIZ, role, "open_drawer");
      expect(res.ok, role).toBe(true);
      if (res.ok) {
        expect(res.pinned).toBe(false);
        expect(res.actor.kind).toBe("member");
        expect(res.actor.staffId).toBeNull();
      }
    }
  });

  it("refuses when there is no role at all", async () => {
    noPinSession();
    expect((await posAuthorize(db, BIZ, null, "open_drawer")).ok).toBe(false);
    expect((await posAuthorize(db, BIZ, undefined, "close_day")).ok).toBe(false);
    expect((await posAuthorize(db, BIZ, "", "void")).ok).toBe(false);
  });

  it("closes the specific hole: cash movement without a PIN cookie", async () => {
    noPinSession();
    // Before, `if (active && ...)` made this a no-op and the movement was
    // recorded unauthorized.
    const res = await posAuthorize(db, BIZ, "staff", "open_drawer");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/PIN pad/i);
  });

  it("never reports needsApproval on the fallback path", async () => {
    // There is no cashier to approve as, so the answer must be yes or no.
    noPinSession();
    const res = await posAuthorize(db, BIZ, "owner", "close_day");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.needsApproval).toBe(false);
  });
});
