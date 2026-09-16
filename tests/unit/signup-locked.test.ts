import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WHATSAPP_E164,
  WHATSAPP_HREF,
  CONTACT_EMAIL,
  PILOT_ONLY_MESSAGE,
} from "@/lib/brand/contact";

// SURGE IS INVITATION-ONLY WHILE THE PILOT RUNS.
//
// Structural, like tests/unit/debug-actions-guarded.test.ts, and for the same
// reason: the thing worth pinning is that the check exists and runs FIRST, and
// that cannot be asserted by calling the action — it needs a Supabase session
// and a service-role client.
//
// WHAT THIS IS GUARDING AGAINST, because it was not obvious and it was live.
// There is no /signup route in this codebase and never has been, which made the
// product look closed. It was not. Three innocent-looking parts added up to a
// complete self-serve signup:
//
//   1. /login offers "Continue with Google", and supabase.auth.signInWithOAuth
//      creates an auth user for any Google account that is not already one.
//   2. requireBusiness() sends a signed-in user with no business to /onboarding.
//   3. createBusiness() inserted a business and an owner membership.
//
// Anyone with a Gmail address could stand up a Surge business. Nobody had —
// all twelve businesses on production trace back to us — but the door was open.

const actions = readFileSync(join(process.cwd(), "app/onboarding/actions.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "app/onboarding/page.tsx"), "utf8");

describe("business creation is gated", () => {
  it("checks platform-admin status inside createBusiness", () => {
    const body = actions.slice(actions.indexOf("export async function createBusiness"));
    expect(body).toContain("isPlatformAdmin");
  });

  it("checks it BEFORE writing anything", () => {
    // Order is the whole assertion. A gate after the insert is not a gate.
    const body = actions.slice(actions.indexOf("export async function createBusiness"));
    const gate = body.indexOf("isPlatformAdmin");
    const insert = body.indexOf(".insert(");
    expect(gate).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(insert);
  });

  it("gates the action, not only the page", () => {
    // The page hiding the form is the polite half. A Next.js server action is a
    // POST to a build-time id that ships in the client bundle, and pages do not
    // run for action invocations — so a form that is never rendered can still
    // be invoked. Both halves have to exist; this asserts the half that counts.
    expect(actions).toContain("isPlatformAdmin");
    expect(page).toContain("isPlatformAdmin");
  });

  it("refuses with an invitation, not an error code", () => {
    // Someone reaching this got through Google sign-in believing they were
    // signing up. "Forbidden" reads as a broken product at the exact moment
    // they have least reason to try again.
    expect(actions).toContain("PILOT_ONLY_MESSAGE");
    expect(PILOT_ONLY_MESSAGE.toLowerCase()).toContain("invitation-only");
    expect(PILOT_ONLY_MESSAGE.toLowerCase()).toContain("get in touch");
  });

  it("keeps that message OUT of the 'use server' module", () => {
    // A "use server" file may only export async functions. Adding one
    // `export const` to actions.ts did not fail loudly — it made the module
    // export nothing at all, so createBusiness vanished and the build failed
    // pointing at the import site rather than the cause. Caught by `next
    // build`, not by tsc, and not by any test until this one.
    expect(actions).not.toMatch(/export\s+(const|let|var|type|interface)\s/);
  });

  it("does not use the debug guard's env-var escape hatch", () => {
    // app/app/debug/guard.ts has a SURGE_ADMIN_EMAILS allowlist whose safety
    // argument is "this can only widen access outside production, which the
    // NODE_ENV check already closed". That argument does not survive being
    // moved somewhere production-effective, and who may create a business is
    // production-effective.
    const helper = readFileSync(
      join(process.cwd(), "lib/services/platform-admin.ts"),
      "utf8"
    );
    expect(helper).not.toContain("SURGE_ADMIN_EMAILS");
  });

  it("fails closed when the admin lookup throws", () => {
    const helper = readFileSync(
      join(process.cwd(), "lib/services/platform-admin.ts"),
      "utf8"
    );
    // A gate that fails open because the database hiccuped is not a gate.
    const c = helper.slice(helper.indexOf("catch"));
    expect(c).toContain("return false");
  });
});

describe("the sign-in page says it before the button, not after", () => {
  const login = readFileSync(join(process.cwd(), "app/login/login-view.tsx"), "utf8");

  it("tells a new visitor that accounts are opened by us", () => {
    // It used to say "New to Surge? Get in touch ↗" and link to /contact. Fine
    // for someone who has not tried anything — wrong once the door at
    // /onboarding is shut, because a stranger reads it, sees a Google button an
    // inch above, presses that instead, and only learns it is invitation-only
    // after handing us their account.
    expect(login).toContain("WHATSAPP_PILOT_HREF");
    expect(login).toContain("CONTACT_EMAIL");
    expect(login.toLowerCase()).toContain("opened by us");
  });

  it("KEEPS Continue with Google", () => {
    // The button that creates an account is the obvious thing to delete, and
    // deleting it would be a serious mistake: seven of our twelve businesses
    // sign IN with Google, including both businesses with real order history,
    // and the owner account that administers the platform. Account creation is
    // closed in createBusiness(), not by removing a sign-in method.
    expect(login).toContain("Continue with Google");
    expect(login).toContain("signInWithOAuth");
  });
});

describe("the way out is a person", () => {
  it("gives WhatsApp and an email on the access screen", () => {
    const screen = readFileSync(join(process.cwd(), "app/onboarding/pilot-access.tsx"), "utf8");
    expect(screen).toContain("WHATSAPP_PILOT_HREF");
    expect(screen).toContain("CONTACT_EMAIL");
  });

  it("builds a wa.me link the way wa.me actually accepts", () => {
    // Digits only, country code included, no +, spaces or dashes. wa.me fails
    // on punctuation by showing the visitor an error page — not at build time,
    // which is why this is worth a test.
    expect(WHATSAPP_E164).toMatch(/^\d{11,15}$/);
    expect(WHATSAPP_HREF).toBe("https://wa.me/" + WHATSAPP_E164);
    expect(WHATSAPP_E164.startsWith("1")).toBe(true); // North American country code
  });

  it("uses the branded inbox rather than a personal address", () => {
    // Also the address SPF is configured for, so a reply does not land in spam.
    expect(CONTACT_EMAIL).toMatch(/@surgetechpos\.com$/);
  });
});
