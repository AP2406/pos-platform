import { SquareClient, SquareEnvironment } from "square";
import { randomUUID } from "crypto";
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

async function getClientForBusiness(
  businessId: string
): Promise<{ client: SquareClient; locationId: string } | null> {
  const access = await getSquareAccess(businessId);
  if (!access || !access.accessToken || !access.locationId) {
    return null;
  }
  const client = new SquareClient({
    token: access.accessToken,
    environment: SquareEnvironment.Production,
  });
  return { client: client, locationId: access.locationId };
}

export function isSquareConfigured(): boolean {
  return !!(process.env.SQUARE_APP_ID && process.env.SQUARE_APP_SECRET);
}

export type SquareInvoiceResult = {
  squareCustomerId: string;
  orderId: string;
  invoiceId: string;
  invoiceStatus: string;
  invoiceUrl: string | null;
};

export async function createDraftSquareInvoice(input: {
  businessId?: string;
  customer: {
    square_customer_id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  trip: {
    pickup_address: string;
    dropoff_address: string;
    scheduled_at: string;
    price_total: number;
  };
  currency: string;
}): Promise<{ ok: true; data: SquareInvoiceResult } | { error: string }> {
  if (!input.businessId) {
    return { error: "No business specified for Square invoice." };
  }

  const ctx = await getClientForBusiness(input.businessId);
  if (!ctx) {
    return { error: "Square not connected for this business." };
  }
  const client = ctx.client;
  const locationId = ctx.locationId;

  try {
    let squareCustomerId = input.customer.square_customer_id;

    if (!squareCustomerId) {
      const nameParts = (input.customer.name ?? "Customer").trim().split(/\s+/);
      const givenName = nameParts[0] || "Customer";
      const familyName = nameParts.slice(1).join(" ") || undefined;

      const createCustResp = await client.customers.create({
        idempotencyKey: randomUUID(),
        givenName: givenName,
        familyName: familyName,
        emailAddress: input.customer.email ?? undefined,
        phoneNumber: input.customer.phone ?? undefined,
      });

      squareCustomerId = createCustResp.customer?.id ?? null;
      if (!squareCustomerId) {
        return { error: "Failed to create Square customer." };
      }
    }

    const cents = BigInt(Math.round(input.trip.price_total * 100));
    const tripDate = new Date(input.trip.scheduled_at).toLocaleDateString(
      "en-CA",
      { year: "numeric", month: "short", day: "numeric" }
    );

    const createOrderResp = await client.orders.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId: locationId,
        customerId: squareCustomerId,
        lineItems: [
          {
            name: "Trip on " + tripDate,
            note:
              input.trip.pickup_address + " -> " + input.trip.dropoff_address,
            quantity: "1",
            basePriceMoney: {
              amount: cents,
              currency: input.currency as "CAD" | "USD",
            },
          },
        ],
      },
    });

    const orderId = createOrderResp.order?.id;
    if (!orderId) return { error: "Failed to create Square order." };

    const dueDate = new Date(input.trip.scheduled_at)
      .toISOString()
      .split("T")[0];

    const createInvoiceResp = await client.invoices.create({
      idempotencyKey: randomUUID(),
      invoice: {
        locationId: locationId,
        orderId: orderId,
        primaryRecipient: { customerId: squareCustomerId },
        acceptedPaymentMethods: {
          card: true,
          squareGiftCard: false,
          bankAccount: false,
          buyNowPayLater: false,
          cashAppPay: false,
        },
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate: dueDate,
          },
        ],
        deliveryMethod: "EMAIL",
        title: "Trip on " + tripDate,
        description:
          input.trip.pickup_address + " -> " + input.trip.dropoff_address,
      },
    });

    const invoice = createInvoiceResp.invoice;
    if (!invoice?.id) return { error: "Failed to create Square invoice." };

    return {
      ok: true,
      data: {
        squareCustomerId: squareCustomerId,
        orderId: orderId,
        invoiceId: invoice.id,
        invoiceStatus: invoice.status ?? "DRAFT",
        invoiceUrl: invoice.publicUrl ?? null,
      },
    };
  } catch (error) {
    console.error("createDraftSquareInvoice error:", error);
    const msg = error instanceof Error ? error.message : "Square API error";
    return { error: msg };
  }
}

export function getSquareDashboardUrl(invoiceId: string): string {
  return "https://app.squareup.com/dashboard/invoices/" + invoiceId;
}