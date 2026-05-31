import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(base + "/app/settings?gads=error");
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(base + "/app/settings?gads=notconfigured");
  }

  let refreshToken: string | null = null;
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await resp.json();
    refreshToken = data.refresh_token ?? null;
  } catch (e) {
    console.error("google-ads token exchange:", e);
  }

  if (!refreshToken) {
    return NextResponse.redirect(base + "/app/settings?gads=notoken");
  }

  try {
    const { business } = await requireBusiness();
    const supabase = await createClient();
    await supabase.from("google_ads_connections").upsert(
      {
        business_id: business.id,
        refresh_token: refreshToken,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "business_id" }
    );
  } catch (e) {
    console.error("google-ads save:", e);
    return NextResponse.redirect(base + "/app/settings?gads=saveerror");
  }

  return NextResponse.redirect(base + "/app/settings?gads=connected");
}