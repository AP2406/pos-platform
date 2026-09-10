"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notice = { title: string; body: React.ReactNode };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // password sign-in
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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

  return (
    <div className="u-serif min-h-screen flex bg-background">
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes oaRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.oa-rise{animation:oaRise .7s cubic-bezier(0.16,1,0.3,1) both}@keyframes oaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-28px)}}.oa-float{animation:oaFloat 9s ease-in-out infinite}",
        }}
      />

      {/* Brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.21 0.045 265), oklch(0.15 0.02 265))",
          }}
        />
        <div
          className="oa-float absolute -top-24 -left-12 w-80 h-80 rounded-full blur-3xl"
          style={{ background: "oklch(0.66 0.19 250 / 0.35)" }}
        />
        <div
          className="oa-float absolute -bottom-16 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "oklch(0.6 0.18 285 / 0.25)", animationDelay: "2.5s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(oklch(1 0 0 / 0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-2.5 oa-rise">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/surge-appicon.svg" alt="Surge" className="w-9 h-9 rounded-lg" />
            <span className="font-semibold text-lg tracking-tight">Surge</span>
          </div>
          <div className="max-w-md">
            <h2
              className="oa-rise text-3xl font-semibold tracking-tight leading-tight"
              style={{ animationDelay: "0.1s" }}
            >
              Welcome to Surge.
            </h2>
            <p
              className="oa-rise text-white/60 mt-4 text-sm leading-relaxed"
              style={{ animationDelay: "0.2s" }}
            >
              Sales, inventory, payments — one clean dashboard to run the whole
              operation.
            </p>
            <div
              className="oa-rise flex flex-wrap gap-2 mt-6"
              style={{ animationDelay: "0.3s" }}
            >
              {["Sales & checkout", "Inventory & menu", "Payments & reports"].map(
                (f) => (
                  <span
                    key={f}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/20 text-white/80"
                  >
                    {f}
                  </span>
                )
              )}
            </div>
          </div>
          <div
            className="oa-rise text-xs text-white/40"
            style={{ animationDelay: "0.4s" }}
          >
            © Surge · surgetechpos.com
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 oa-rise">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/surge-appicon.svg" alt="Surge" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-lg tracking-tight">Surge</span>
          </div>

          {notice ? (
            <div className="oa-rise text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold tracking-tight mt-5">
                {notice.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">{notice.body}</p>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setError(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline mt-6"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="oa-rise">
                <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                <p className="text-muted-foreground text-sm mt-1.5">
                  Use your email and password to continue.
                </p>
              </div>

              <div className="oa-rise mt-8" style={{ animationDelay: "0.08s" }}>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                  className="flex items-center justify-center gap-2.5 w-full h-11 rounded-lg bg-white text-[#3c4043] text-sm font-medium border border-black/10 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  {googleLoading ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin text-gray-500">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Redirecting to Google…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>
              </div>

              <div className="oa-rise relative my-6" style={{ animationDelay: "0.16s" }}>
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <form
                onSubmit={handlePasswordSubmit}
                className="oa-rise space-y-4"
                style={{ animationDelay: "0.24s" }}
              >
                <div>
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourbusiness.com"
                    className="mt-2 flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={busy}
                      className="text-xs text-muted-foreground hover:text-foreground underline disabled:opacity-60"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-2 flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <p
                className="oa-rise mt-6 text-center text-xs text-muted-foreground"
                style={{ animationDelay: "0.32s" }}
              >
                Accounts are set up by Surge. Need access?{" "}
                <a
                  href="mailto:info@surgetechpos.com"
                  className="font-medium text-foreground hover:underline"
                >
                  Contact us
                </a>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
