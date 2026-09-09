import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// requireBusiness reaches for Supabase + next/headers, so it's stubbed here.
// What's under test is the decision logic: session → permission → validation →
// handler, and that each stage fails closed.
const requireBusiness = vi.fn();
const assertConfigEditable = vi.fn();

vi.mock("@/lib/services/tenancy", () => ({
  requireBusiness: () => requireBusiness(),
  assertConfigEditable: (b: unknown) => assertConfigEditable(b),
  DemoLockedError: class DemoLockedError extends Error {},
}));

const { authorizeAction, createAuthorizedAction } = await import(
  "@/lib/services/action-guard"
);

const asRole = (role: string) => ({
  role,
  business: { id: "biz-1", name: "Aathy Bistro", is_demo: false },
});

beforeEach(() => {
  requireBusiness.mockReset();
  assertConfigEditable.mockReset();
});

describe("authorizeAction", () => {
  it("allows a role that holds the permission", async () => {
    requireBusiness.mockResolvedValue(asRole("manager"));
    const auth = await authorizeAction("edit_menu");
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.business.id).toBe("biz-1");
  });

  it("refuses a role that does not", async () => {
    requireBusiness.mockResolvedValue(asRole("server"));
    const auth = await authorizeAction("edit_menu");
    expect(auth.ok).toBe(false);
  });

  it("refuses a bookkeeper the menu, and a cook the books", async () => {
    requireBusiness.mockResolvedValue(asRole("bookkeeper"));
    expect((await authorizeAction("edit_menu")).ok).toBe(false);
    expect((await authorizeAction("export_data")).ok).toBe(true);

    requireBusiness.mockResolvedValue(asRole("staff"));
    expect((await authorizeAction("export_data")).ok).toBe(false);
  });

  it("refuses when there is no usable session", async () => {
    requireBusiness.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const auth = await authorizeAction("edit_menu");
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.error).toMatch(/sign in/i);
  });

  it("refuses an unknown role rather than defaulting to allow", async () => {
    requireBusiness.mockResolvedValue(asRole("regional-director-of-vibes"));
    expect((await authorizeAction("edit_menu")).ok).toBe(false);
  });

  it("keeps demo businesses locked on config writes", async () => {
    requireBusiness.mockResolvedValue(asRole("owner"));
    assertConfigEditable.mockImplementation(() => {
      throw new Error("This is a demo account — the menu is locked.");
    });

    // Permission alone isn't enough when the business itself is locked...
    const locked = await authorizeAction("edit_menu", { configWrite: true });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toMatch(/demo/i);

    // ...but a non-config action is unaffected.
    expect((await authorizeAction("edit_menu")).ok).toBe(true);
  });

  it("checks the permission before the demo lock, so refusals don't leak state", async () => {
    requireBusiness.mockResolvedValue(asRole("server"));
    assertConfigEditable.mockImplementation(() => {
      throw new Error("This is a demo account — the menu is locked.");
    });
    const auth = await authorizeAction("edit_menu", { configWrite: true });
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.error).not.toMatch(/demo/i);
    expect(assertConfigEditable).not.toHaveBeenCalled();
  });
});

describe("createAuthorizedAction", () => {
  const schema = z.object({ name: z.string().min(1, "Name is required") });
  const handler = vi.fn(async () => ({ ok: true as const, id: "new-1" }));

  beforeEach(() => handler.mockClear());

  it("runs the handler for an authorized caller with valid input", async () => {
    requireBusiness.mockResolvedValue(asRole("manager"));
    const action = createAuthorizedAction("edit_menu", schema, handler);
    const res = await action({ name: "Negroni" });
    expect(res).toEqual({ ok: true, id: "new-1" });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("never reaches the handler without the permission", async () => {
    requireBusiness.mockResolvedValue(asRole("server"));
    const action = createAuthorizedAction("edit_menu", schema, handler);
    const res = await action({ name: "Negroni" });
    expect(res).toHaveProperty("error");
    expect(handler).not.toHaveBeenCalled();
  });

  it("never reaches the handler with invalid input", async () => {
    requireBusiness.mockResolvedValue(asRole("owner"));
    const action = createAuthorizedAction("edit_menu", schema, handler);
    const res = await action({ name: "" });
    expect(res).toEqual({ error: "Name is required" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks permission before validation, so input shape isn't probeable", async () => {
    requireBusiness.mockResolvedValue(asRole("server"));
    const action = createAuthorizedAction("edit_menu", schema, handler);
    const res = await action({ nope: 1 });
    // A refusal, not a schema hint.
    expect(res).toHaveProperty("error");
    if ("error" in res) expect(res.error).not.toMatch(/required/i);
  });

  it("hands the handler the resolved business context", async () => {
    requireBusiness.mockResolvedValue(asRole("owner"));
    const spy = vi.fn(async () => ({ ok: true as const }));
    const action = createAuthorizedAction("edit_menu", schema, spy);
    await action({ name: "Negroni" });
    expect(spy).toHaveBeenCalledWith(
      { name: "Negroni" },
      expect.objectContaining({ role: "owner" })
    );
  });
});
