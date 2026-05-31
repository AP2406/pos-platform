import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Google Ads is not configured." },
      { status: 500 }
    );
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
  });
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
  return NextResponse.redirect(url);
}