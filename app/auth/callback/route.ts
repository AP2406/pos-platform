import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  // Redirect to the canonical app host, never a vercel.app origin. Falls back to
  // the request origin only if the env var isn't set.
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  // Something went wrong (bad code, expired link, etc.) — send back to login
  return NextResponse.redirect(`${base}/login?error=auth_failed`);
}