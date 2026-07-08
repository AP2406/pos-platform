import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_ORIGIN = "https://www.surgetechpos.com";

export async function middleware(request: NextRequest) {
  // Host guard FIRST: any *.vercel.app deployment URL (preview or the project's
  // production alias) 308-redirects to the canonical marketing host, preserving
  // path + query. Cannot loop — the destination host is www.surgetechpos.com,
  // which never ends in ".vercel.app". The www/app split itself is handled at
  // the Vercel domain layer, not here, so this doesn't interfere with it.
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host.endsWith(".vercel.app")) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL_ORIGIN);
    return NextResponse.redirect(target, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};