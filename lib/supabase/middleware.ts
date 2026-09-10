import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PREVIEW_COOKIE = "surge_preview";

/**
 * Runs on every request that matches the middleware matcher.
 * - Refreshes the Supabase session cookie if needed
 * - Redirects unauthenticated users away from /app routes
 * - Reviewer link: OUTSIDE PRODUCTION ONLY, when PREVIEW_LOGIN_TOKEN is
 *   configured and the request carries ?key=<token>, signs the dedicated
 *   reviewer account in (a normal Supabase session — RLS and role checks apply
 *   as for any manager) so an outside reviewer can open the dashboard without a
 *   password. Preview sessions are kept out of /app/debug and /hq. Remove the
 *   env vars to revoke; see the previewAllowed block below for the prod gate.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;

  // ---------------------------------------------------------------------------
  // Reviewer preview. There are TWO ways in, and BOTH are gated on
  // `previewAllowed` (NODE_ENV !== "production"):
  //
  //   1. `?key=<PREVIEW_LOGIN_TOKEN>` on any request — the link you hand to a
  //      reviewer.
  //   2. `OPEN_PREVIEW = true` below — no query string needed, for a reviewer
  //      whose fetcher can't carry one. Flip it only to share a local dev
  //      server behind a tunnel, and flip it back when they're done. Pair it
  //      with the twin flag in app/robots.ts, which otherwise tells well-behaved
  //      crawlers to skip /app and makes the link look broken.
  //
  // Either way, a request to /app is signed in as the dedicated reviewer
  // account with no sign-in page. That is not a hole punched through auth: the
  // request still carries a real Supabase session, so RLS confines it to that
  // account's one business and every permission check still runs; /app/debug
  // and /hq stay blocked either way.
  //
  // `previewAllowed` is the load-bearing term and must stay on BOTH paths. This
  // file deploys to Vercel and the database behind it holds other tenants'
  // businesses. Because the whole mechanism is short-circuited off in
  // production, neither a committed `OPEN_PREVIEW = true` NOR a
  // PREVIEW_LOGIN_TOKEN / PREVIEW_REVIEWER_EMAIL / PREVIEW_REVIEWER_PASSWORD
  // trio set in the Vercel Production environment can sign anyone in there.
  // Previously only path 2 carried the NODE_ENV term, so production env vars
  // would have made `?key=` live against real tenants; do not un-gate either.
  // ---------------------------------------------------------------------------
  const previewAllowed = process.env.NODE_ENV !== "production";
  const OPEN_PREVIEW = false;

  let previewSignIn = false;
  const previewToken = process.env.PREVIEW_LOGIN_TOKEN;
  const key = request.nextUrl.searchParams.get("key");
  const openPreview = OPEN_PREVIEW && previewAllowed;
  const keyMatches =
    previewAllowed && !!previewToken && !!key && key === previewToken;
  // An existing Supabase session means we don't need to sign in again — without
  // this, open mode would do a password sign-in on every request and trip the
  // auth rate limit within a page load or two.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const needsPreviewSignIn =
    previewAllowed && (keyMatches || (openPreview && !hasSession));
  if (needsPreviewSignIn && process.env.PREVIEW_REVIEWER_EMAIL && process.env.PREVIEW_REVIEWER_PASSWORD) {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.PREVIEW_REVIEWER_EMAIL,
      password: process.env.PREVIEW_REVIEWER_PASSWORD,
    });
    if (!error) {
      previewSignIn = true;
      request.cookies.set(PREVIEW_COOKIE, "1");
      response.cookies.set(PREVIEW_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
    }
  }
  // In open mode every visitor is a preview visitor, whether or not they picked
  // up the marker cookie — otherwise someone arriving with a stale session but
  // no marker would slip past the /app/debug and /hq blocks below.
  const isPreview =
    previewSignIn || openPreview || request.cookies.get(PREVIEW_COOKIE)?.value === "1";

  // Refreshes auth cookie if expired. A stale/invalid refresh token makes
  // getUser() throw ("Invalid Refresh Token") — treat that as logged out rather
  // than 500-ing the request.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  // A reviewer landing on the login page or the marketing root goes straight to
  // the dashboard. In open mode this applies on every request, not just the one
  // that signed in — the sign-in page shouldn't exist for a reviewer at all.
  if ((previewSignIn || openPreview) && user && (path === "/login" || path === "/" || path === "/preview")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c.name, c.value, c));
    return redirect;
  }

  // Preview sessions never reach internal/debug surfaces.
  if (isPreview && user && (path.startsWith("/app/debug") || path.startsWith("/hq"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Protect /app and /hq routes — if no user, send them to login. (/hq also has a
  // platform-admin gate in its layout; this is the logged-out fast path.)
  if (!user && (path.startsWith("/app") || path.startsWith("/hq"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
