"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SurgeLogo } from "@/components/brand/surge-logo";
import { LoginHeroPanel, type LoginHero } from "./hero-panels";

type Notice = { title: string; body: React.ReactNode };

// WHAT THE MOCKUPS ASKED FOR AND WHAT IS ACTUALLY WIRED.
//
// The approved comps show seven auxiliary controls. Four of them have nothing
// behind them in this codebase, and a control that does nothing on a sign-in
// page is worse than an absent one — it is the screen where a stuck operator
// has the least patience and the fewest alternatives. So:
//
//  KEPT, wired to what already existed
//    · Forgot password?   -> supabase.auth.resetPasswordForEmail, the same call
//                            this page has always made, landing on /auth/reset.
//    · Contact support ↗  -> /contact, a real route with a real form, a real
//                            inbox (info@surgetechpos.com) and a phone number.
//    · Get in touch ↗     -> /contact as well. Two entrances, because the comp
//                            has two and they are read at different moments:
//                            "I cannot get in" at the top, "I have no account"
//                            at the bottom. Same destination, honestly.
//
//  KEPT, relabelled
//    · "Continue with single sign-on" -> "Continue with Google". There is no
//      SAML/OIDC SSO here: supabase.auth.signInWithSSO appears nowhere in the
//      repo and no enterprise IdP is configured. What DOES exist, and has
//      shipped for months, is Google OAuth — so the comp's second auth button
//      keeps its place and its shape and tells the truth about where it goes.
//      Renaming it was the only option that neither ships a dead button nor
//      deletes a working sign-in path.
//
//  DROPPED
//    · Remember me. Sessions here are Supabase cookie sessions written by
//      @supabase/ssr; they already persist across restarts and their lifetime
//      is set by the project's refresh-token policy, not by this form. There is
//      no per-sign-in switch to bind the checkbox to, and building one means
//      changing how sessions are stored — auth work, explicitly out of scope
//      for a layout pass. A checkbox that is checked-by-default-and-ignored is
//      a lie about security, which is the worst kind to ship.
//    · Privacy policy / Terms of service. Neither page exists. There is no
//      /privacy and no /terms route anywhere in app/, and nothing else in the
//      product links to one. Two 404s in the footer of the sign-in page would
//      be the first thing an operator clicks and the first thing that breaks.
//      Re-add the links in the same breath as the pages.

/**
 * @param hero which left-hand panel to render. See hero-panels.tsx.
 */
export function LoginView({ hero }: { hero: LoginHero }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); // password sign-in
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const errorId = useId();

  // ---------------------------------------------------------------------------
  // AUTH. Unchanged from the page this replaces — same client, same three calls,
  // same redirect, same error handling. This commit is layout and colour.
  // ---------------------------------------------------------------------------
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/callback",
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // Full reload so the SSR server picks up the new session cookie.
    window.location.href = "/app";
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then tap Forgot password.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/auth/callback?next=/auth/reset" }
    );
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice({
      title: "Check your inbox",
      body: (
        <>
          We sent a password reset link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Open it
          to set a new password.
        </>
      ),
    });
  }

  const busy = loading || googleLoading;

  // One focus treatment for every interactive thing on the page. `focus-visible`
  // rather than `focus` so a mouse click on the eye toggle doesn't leave a ring
  // behind, and an offset so the ring reads as a ring rather than as a border
  // that changed colour.
  const focusRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const field =
    "h-12 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-xs " +
    "placeholder:text-muted-foreground transition-colors " +
    "focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
    "disabled:opacity-60 aria-invalid:border-destructive";

  return (
    // THE SPLIT. A two-column grid above lg and a single column below it, so
    // the collapse is the grid falling back to one track rather than a second
    // layout maintained in parallel. The panel is not rendered at all on a
    // phone — it carries no control, and a 100vh decoration above the form on a
    // 375px screen is a scroll the operator has to undo before they can type.
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[1.25fr_1fr]">
      <div className="relative hidden lg:block">
        <LoginHeroPanel hero={hero} />
      </div>

      {/* The form column scrolls in its own right. On a phone with the keyboard
          up, 100dvh can fall below the height of the form; `overflow-y-auto`
          plus `my-auto` centres it when there is room and lets it scroll when
          there isn't, instead of clipping the sign-in button off the bottom. */}
      <div className="flex max-h-[100dvh] flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:px-14">
        {/* The help row is the only thing in the column's header. The mark does
            NOT go here on a phone: the kit's horizontal lockup has a 220px
            floor and this row has no 220px to give beside a link, so squeezing
            it in would break the one rule the kit is explicit about. It gets
            its own line below instead, at full size. */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 text-xs">
          <span className="text-muted-foreground">Need help?</span>
          <a
            href="/contact"
            className={"rounded-sm font-medium text-foreground hover:underline " + focusRing}
          >
            Contact support <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="my-auto w-full max-w-[400px] py-10 lg:mx-auto">
          {/* The narrow-viewport identity, standing alone with the whole column
              to itself — so it gets the full lockup at the kit's floor width.
              Above lg the hero panel carries it and repeating it here would put
              two lockups on one screen. */}
          <SurgeLogo className="mb-10 h-[65px] w-[220px] lg:hidden" />
          {notice ? (
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                  <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
                </svg>
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight">{notice.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{notice.body}</p>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setError(null);
                }}
                className={"mt-6 rounded-sm text-xs text-muted-foreground underline hover:text-foreground " + focusRing}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Surge admin
              </p>
              {/* The full stop is in the comp and it is doing work: it turns a
                  greeting into a statement, which is the difference between a
                  page that welcomes you and one that is simply glad you're
                  back. Kept verbatim. */}
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back.
              </h1>
              <p className="mt-3 text-muted-foreground">
                Sign in to manage your restaurant.
              </p>

              <form onSubmit={handlePasswordSubmit} className="mt-9 space-y-5">
                <div>
                  <label htmlFor="email" className="text-sm font-semibold">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    aria-describedby={error ? errorId : undefined}
                    className={"mt-2 " + field}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="text-sm font-semibold">
                    Password
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      aria-describedby={error ? errorId : undefined}
                      className={field + " pr-12"}
                    />
                    {/* THE EYE TOGGLE. `aria-pressed` rather than a label that
                        flips, so the control keeps one name in the
                        accessibility tree and announces its STATE — "Show
                        password, toggle button, pressed" — instead of renaming
                        itself under the reader mid-interaction. aria-controls
                        ties it to the field it governs. It is deliberately
                        outside the tab order's way (it comes after the input)
                        and is never disabled: revealing what you typed is the
                        one thing that still helps while a sign-in is in
                        flight. */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Show password"
                      aria-pressed={showPassword}
                      aria-controls="password"
                      className={
                        "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg " +
                        "text-muted-foreground transition-colors hover:text-foreground " +
                        focusRing
                      }
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path d="M16.7 16.7A9.9 9.9 0 0 1 12 18c-5 0-9-3.5-10-6a13 13 0 0 1 4-4.7" />
                          <path d="M7.3 7.3A9.9 9.9 0 0 1 12 6c5 0 9 3.5 10 6a13 13 0 0 1-3 3.9" />
                          <path d="m3 3 18 18" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
                          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z" />
                          <circle cx="12" cy="12" r="2.6" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* The comp's "Remember me · Forgot password?" row, minus the
                    half that had nothing behind it. Right-aligned rather than
                    left, so the link stays anchored to the field it acts on. */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={busy}
                    className={"rounded-sm text-sm text-muted-foreground hover:text-foreground hover:underline disabled:opacity-60 " + focusRing}
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  // role="alert" so a failed sign-in is spoken without the
                  // reader having to go looking for it.
                  <p id={errorId} role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className={
                    "flex h-12 w-full items-center justify-center gap-2 rounded-lg " +
                    "bg-auth-cta text-sm font-semibold text-auth-cta-foreground " +
                    "transition-colors hover:bg-auth-cta-hover disabled:opacity-60 " +
                    focusRing
                  }
                >
                  {loading ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-6">
                <span className="absolute inset-0 flex items-center" aria-hidden="true">
                  <span className="w-full border-t border-border" />
                </span>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className={
                  "flex h-12 w-full items-center justify-center gap-2.5 rounded-lg " +
                  "border border-input bg-card text-sm font-medium text-foreground shadow-xs " +
                  "transition-colors hover:bg-accent disabled:opacity-60 " +
                  focusRing
                }
              >
                {googleLoading ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Redirecting to Google…
                  </>
                ) : (
                  <>
                    {/* The one set of literal hex values on this page, and the
                        only ones that are not ours to tokenise: Google's brand
                        guidelines fix the four colours of the G and forbid
                        recolouring it. Everything else here is a token. */}
                    <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              <p className="mt-7 text-center text-sm text-muted-foreground">
                New to Surge?{" "}
                <a
                  href="/contact"
                  className={"rounded-sm font-medium text-foreground hover:underline " + focusRing}
                >
                  Get in touch <span aria-hidden="true">↗</span>
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
