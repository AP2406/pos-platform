import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const SCOPES = [
  "MERCHANT_PROFILE_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "ORDERS_WRITE",
  "INVOICES_READ",
  "INVOICES_WRITE",
];

export async function GET(request: NextRequest) {
  const appId = process.env.SQUARE_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "Square app not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams();
  params.set("client_id", appId);
  params.set("scope", SCOPES.join(" "));
  params.set("session", "false");
  params.set("state", state);

  const authorizeUrl =
    "https://connect.squareup.com/oauth2/authorize?" + params.toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("square_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}