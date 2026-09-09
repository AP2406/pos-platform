import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PREVIEW_COOKIE = "surge_preview";

/**
 * Runs on every request that matches the middleware matcher.
 * - Refreshes the Supabase session cookie if needed
 * - Redirects unauthenticated users away from /app routes
 * - Reviewer link: when PREVIEW_LOGIN_TOKEN is configured and the request
 *   carries ?key=<token>, signs the dedicated reviewer account in (a normal
 *   Supabase session — RLS and role checks apply as for any manager) so an
 *   outside reviewer can open the dashboard without a password. Preview
 *   sessions are kept out of /app/debug and /hq. Remove the env vars to revoke.
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

  // ===========================================================================
  // TEMPORARY: LOGIN DISABLED FOR AN OUTSIDE DESIGN REVIEW
  //
  // TO PUT THE LOGIN BACK: set OPEN_PREVIEW below to `false`. That single edit
  // restores normal behaviour — everything else in this file is unchanged.
  //
  // While it's `true`, any request to /app is silently signed in as the
  // dedicated reviewer account, so no sign-in page is ever shown. This is not a
  // hole punched through auth: the request still carries a real Supabase
  // session, so RLS confines it to that account's one business (Aathy Bistro)
  // and every permission check still runs. /app/debug and /hq stay blocked.
  //
  // The `NODE_ENV` term is deliberate and should stay: this same file is
  // deployed to Vercel, and the project's database holds other people's
  // businesses. Open access is a local-dev-behind-a-tunnel thing only.
  // ===========================================================================
  const OPEN_PREVIEW = true;

  let previewSignIn = false;
  const previewToken = process.env.PREVIEW_LOGIN_TOKEN;
  const key = request.nextUrl.searchParams.get("key");
  const openPreview = OPEN_PREVIEW && process.env.NODE_ENV !== "production";
  const keyMatches = !!previewToken && !!key && key === previewToken;
  // An existing Supabase session means we don't need to sign in again — without
  // this, open mode would do a password sign-in on every request and trip the
  // auth rate limit within a page load or two.
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const needsPreviewSignIn = keyMatches || (openPreview && !hasSession);
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
