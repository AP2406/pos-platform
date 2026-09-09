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

  // Reviewer link → sign the reviewer account in for this request (cookies land
  // on both the request, so server components see the session, and the response).
  let previewSignIn = false;
  const previewToken = process.env.PREVIEW_LOGIN_TOKEN;
  const key = request.nextUrl.searchParams.get("key");
  if (previewToken && key && key === previewToken && process.env.PREVIEW_REVIEWER_EMAIL && process.env.PREVIEW_REVIEWER_PASSWORD) {
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
  const isPreview = previewSignIn || request.cookies.get(PREVIEW_COOKIE)?.value === "1";

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

  // A reviewer landing on the login page or the marketing root with a valid key
  // goes straight to the dashboard.
  if (previewSignIn && user && (path === "/login" || path === "/" || path === "/preview")) {
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
