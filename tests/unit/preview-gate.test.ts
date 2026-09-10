import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// The reviewer preview is a password sign-in performed by middleware on behalf
// of an anonymous request. It must be structurally impossible in production:
// `?key=<PREVIEW_LOGIN_TOKEN>` against https://www.surgetechpos.com/app used to
// depend only on the env vars being present, so a PREVIEW_* trio pasted into
// Vercel's Production environment would have signed a stranger into a real
// tenant. Both entry points now require NODE_ENV !== "production"; these tests
// pin that, with a development case as the positive control so a regression
// that simply disables the mechanism everywhere still fails the suite.

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      getUser: mocks.getUser,
    },
  }),
}));

import { updateSession } from "@/lib/supabase/middleware";

const TOKEN = "reviewer-token-abc123";

function appRequestWithKey(key: string = TOKEN) {
  return new NextRequest(
    new URL(`https://www.surgetechpos.com/app?key=${key}`)
  );
}

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: null } });

  // The full reviewer configuration, exactly as it would look if someone had
  // set it in the Vercel Production environment.
  vi.stubEnv("PREVIEW_LOGIN_TOKEN", TOKEN);
  vi.stubEnv("PREVIEW_REVIEWER_EMAIL", "reviewer@example.com");
  vi.stubEnv("PREVIEW_REVIEWER_PASSWORD", "reviewer-password");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-placeholder");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reviewer ?key= path is inert in production", () => {
  it("never attempts a password sign-in", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await updateSession(appRequestWithKey());

    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("bounces the anonymous request to /login instead of the dashboard", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await updateSession(appRequestWithKey());

    expect(response.headers.get("location")).toBe(
      "https://www.surgetechpos.com/login"
    );
  });

  it("does not hand out the preview marker cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await updateSession(appRequestWithKey());

    expect(response.cookies.get("surge_preview")).toBeUndefined();
  });
});

describe("reviewer ?key= path still works outside production", () => {
  it("signs the reviewer account in on a matching token", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await updateSession(appRequestWithKey());

    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "reviewer@example.com",
      password: "reviewer-password",
    });
  });

  it("ignores a wrong token", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await updateSession(appRequestWithKey("not-the-token"));

    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});
