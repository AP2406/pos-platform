import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

const SQUARE_VERSION = "2024-07-17";
const SQUARE_BASE = "https://connect.squareup.com";
const REFRESH_BUFFER_MS = 3 * 24 * 60 * 60 * 1000;

type SquareAccess = {
  accessToken: string;
  locationId: string | null;
  merchantId: string | null;
};

async function refreshAccessToken(
  businessId: string,
  refreshToken: string
): Promise<string | null> {
  const appId = process.env.SQUARE_APP_ID;
  const appSecret = process.env.SQUARE_APP_SECRET;
  if (!appId || !appSecret) {
    return null;
  }

  const res = await fetch(SQUARE_BASE + "/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_VERSION,
    },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return null;
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    access_token: encryptSecret(data.access_token),
    token_expires_at: data.expires_at || null,
    updated_at: new Date().toISOString(),
  };
  if (data.refresh_token) {
    update.refresh_token = encryptSecret(data.refresh_token);
  }

  await supabase
    .from("business_integrations")
    .update(update)
    .eq("business_id", businessId)
    .eq("provider", "square");

  return data.access_token;
}

export async function getSquareAccess(
  businessId: string
): Promise<SquareAccess | null> {
  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("business_integrations")
    .select(
      "access_token, refresh_token, token_expires_at, location_id, merchant_id, is_active"
    )
    .eq("business_id", businessId)
    .eq("provider", "square")
    .maybeSingle();

  if (error || !row || !row.is_active || !row.access_token) {
    return null;
  }

  let accessToken = decryptSecret(row.access_token);

  const expiresAt = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt - Date.now() < REFRESH_BUFFER_MS;

  if (needsRefresh && row.refresh_token) {
    const refreshed = await refreshAccessToken(
      businessId,
      decryptSecret(row.refresh_token)
    );
    if (refreshed) {
      accessToken = refreshed;
    }
  }

  return {
    accessToken: accessToken,
    locationId: row.location_id,
    merchantId: row.merchant_id,
  };
}

export async function squareFetch(
  businessId: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const access = await getSquareAccess(businessId);
  if (!access) {
    throw new Error("Square not connected for this business");
  }

  const headers = new Headers(init && init.headers ? init.headers : undefined);
  headers.set("Square-Version", SQUARE_VERSION);
  headers.set("Authorization", "Bearer " + access.accessToken);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(SQUARE_BASE + path, { ...(init || {}), headers: headers });
}
export function getSquareDashboardUrl(invoiceId: string): string {
  return "https://app.squareup.com/dashboard/invoices/" + invoiceId;
}