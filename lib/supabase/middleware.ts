import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every request that matches the middleware matcher.
 * - Refreshes the Supabase session cookie if needed
 * - Redirects unauthenticated users away from /app routes
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

  // Protect /app and /hq routes — if no user, send them to login. (/hq also has a
  // platform-admin gate in its layout; this is the logged-out fast path.)
  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith("/app") || path.startsWith("/hq"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}