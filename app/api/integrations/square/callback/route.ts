import { NextRequest, NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

const SQUARE_VERSION = "2024-07-17";
const SETTINGS_PATH = "/app/settings";

function settingsRedirect(request: NextRequest, status: string) {
  const url = new URL(SETTINGS_PATH, request.url);
  url.searchParams.set("square", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return settingsRedirect(request, "denied");
  }

  const cookieState = request.cookies.get("square_oauth_state")?.value;
  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return settingsRedirect(request, "error");
  }

  let business;
  let role;
  try {
    const ctx = await requireBusiness();
    business = ctx.business;
    role = ctx.role;
  } catch {
    return settingsRedirect(request, "error");
  }
  if (role !== "owner") {
    return settingsRedirect(request, "forbidden");
  }

  const appId = process.env.SQUARE_APP_ID;
  const appSecret = process.env.SQUARE_APP_SECRET;
  if (!appId || !appSecret) {
    return settingsRedirect(request, "error");
  }

  const tokenRes = await fetch("https://connect.squareup.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      code: code,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    return settingsRedirect(request, "error");
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || null;
  const merchantId = tokenData.merchant_id || null;
  const expiresAt = tokenData.expires_at || null;

  let locationId = null;
  const locRes = await fetch("https://connect.squareup.com/v2/locations", {
    method: "GET",
    headers: {
      "Square-Version": SQUARE_VERSION,
      Authorization: "Bearer " + accessToken,
    },
  });
  const locData = await locRes.json();
  if (
    locRes.ok &&
    Array.isArray(locData.locations) &&
    locData.locations.length > 0
  ) {
    locationId = locData.locations[0].id;
  }

  const supabase = await createClient();
  const { error: upsertError } = await supabase
    .from("business_integrations")
    .upsert(
      {
        business_id: business.id,
        provider: "square",
        environment: "production",
        access_token: encryptSecret(accessToken),
        refresh_token: refreshToken ? encryptSecret(refreshToken) : null,
        token_expires_at: expiresAt,
        merchant_id: merchantId,
        location_id: locationId,
        is_active: true,
        last_error: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,provider" }
    );

  if (upsertError) {
    return settingsRedirect(request, "error");
  }

  const response = settingsRedirect(request, "connected");
  response.cookies.delete("square_oauth_state");
  return response;
}