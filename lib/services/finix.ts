const FINIX_API_BASE =
  process.env.FINIX_ENVIRONMENT === "live"
    ? "https://finix.live-payments-api.com"
    : "https://finix.sandbox-payments-api.com";

function getCredentials(): { username: string; password: string } | null {
  const username = process.env.FINIX_USERNAME;
  const password = process.env.FINIX_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

function authHeader(): string {
  const creds = getCredentials();
  if (!creds) throw new Error("Finix credentials missing");
  const encoded = Buffer.from(creds.username + ":" + creds.password).toString("base64");
  return "Basic " + encoded;
}

export function isFinixConfigured(): boolean {
  return (
    !!process.env.FINIX_USERNAME &&
    !!process.env.FINIX_PASSWORD &&
    !!process.env.FINIX_APPLICATION_ID
  );
}

export function getFinixConfig() {
  return {
    applicationId: process.env.FINIX_APPLICATION_ID ?? "",
    merchantId: process.env.FINIX_MERCHANT_ID ?? "",
    environment: process.env.FINIX_ENVIRONMENT ?? "sandbox",
    baseUrl: FINIX_API_BASE,
  };
}

type FinixError = { error: string; status?: number; details?: unknown };
type FinixResult<T> = { ok: true; data: T } | FinixError;

async function finixRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<FinixResult<T>> {
  if (!isFinixConfigured()) {
    return { error: "Finix is not configured. Check environment variables." };
  }

  const url = FINIX_API_BASE + path;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/hal+json",
        "Finix-Version": "2022-02-01",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.error("Finix " + method + " " + path + " failed:", response.status, data);
      return {
        error: "Finix API error (" + response.status + ")",
        status: response.status,
        details: data,
      };
    }

    return { ok: true, data: data as T };
  } catch (err) {
    console.error("Finix " + method + " " + path + " exception:", err);
    return { error: "Finix request failed. Check network or credentials." };
  }
}

export const finix = {
  get: <T>(path: string) => finixRequest<T>("GET", path),
  post: <T>(path: string, body: unknown) => finixRequest<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => finixRequest<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => finixRequest<T>("PATCH", path, body),
  delete: <T>(path: string) => finixRequest<T>("DELETE", path),
};

// ---------- Payment Instrument types & helpers ----------
// NOTE: createPaymentInstrument takes a RAW card number and is only used by the
// /app/debug charge harness. The production register path tokenizes the card in
// the browser and never sends a raw PAN to the server. Remove this helper once
// the debug harness is retired.

export type CreatePaymentInstrumentInput = {
  identity: string; // Finix Identity ID (buyer)
  type: "PAYMENT_CARD";
  name: string; // cardholder name
  number: string;
  expiration_month: number;
  expiration_year: number;
  security_code: string;
};

export type FinixPaymentInstrument = {
  id: string;
  fingerprint?: string;
  card_brand?: string;
  last_four?: string;
  expiration_month?: number;
  expiration_year?: number;
  created_at: string;
};

export async function createPaymentInstrument(input: CreatePaymentInstrumentInput) {
  return finix.post<FinixPaymentInstrument>("/payment_instruments", input);
}

// ---------- Buyer Identity helpers ----------

export type CreateBuyerIdentityInput = {
  entity: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
};

export type FinixIdentityResponse = {
  id: string;
  entity: Record<string, unknown>;
  created_at: string;
};

export async function createBuyerIdentity(input: CreateBuyerIdentityInput) {
  return finix.post<FinixIdentityResponse>("/identities", input);
}

// ---------- Transfer (charge) types & helpers ----------
// NOTE: createTransfer uses the legacy "merchant_identity" field and is only
// used by the /app/debug harness. The production register path posts to
// /transfers directly with the documented "merchant" field. Retire with debug.

export type CreateTransferInput = {
  amount: number; // in cents
  currency: string; // "USD" or "CAD"
  source: string; // Payment Instrument ID
  merchant_identity: string; // Merchant Identity ID that receives the funds
  tags?: Record<string, string>;
  idempotency_id?: string;
};

export type FinixTransfer = {
  id: string;
  amount: number;
  currency: string;
  state: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  failure_code?: string;
  failure_message?: string;
  source: string;
  merchant_identity: string;
  created_at: string;
};

export async function createTransfer(input: CreateTransferInput) {
  return finix.post<FinixTransfer>("/transfers", input);
}

// ---------- Refund types & helpers ----------

export type CreateRefundInput = {
  refundAmount: number; // in cents
  tags?: Record<string, string>;
  idempotency_id?: string;
};

export type FinixRefund = {
  id: string;
  amount: number;
  currency: string;
  state: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  parent_transfer: string;
  failure_code?: string;
  failure_message?: string;
  created_at: string;
};

export async function refundTransfer(transferId: string, input: CreateRefundInput) {
  return finix.post<FinixRefund>("/transfers/" + transferId + "/reversals", {
    refund_amount: input.refundAmount,
    tags: input.tags,
    idempotency_id: input.idempotency_id,
  });
}

// ---------- Webhook signature verification ----------
// NOTE: This helper assumes a Stripe-style signature and is NOT how Finix signs
// webhooks. The real verification (the Finix-Signature header) lives in the
// webhook route. This helper is unused and can be removed.

import { createHmac, timingSafeEqual } from "crypto";

export function verifyFinixWebhook(
  payload: string,
  signatureHeader: string | null,
  secret: string
): { valid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { valid: false, reason: "Missing signature header" };
  }

  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    },
    {}
  );

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return { valid: false, reason: "Malformed signature header" };
  }

  const eventTime = parseInt(timestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - eventTime) > 300) {
    return { valid: false, reason: "Timestamp too old (replay protection)" };
  }

  const signedPayload = timestamp + "." + payload;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== sigBuf.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }
    if (!timingSafeEqual(expectedBuf, sigBuf)) {
      return { valid: false, reason: "Signature does not match" };
    }
  } catch {
    return { valid: false, reason: "Signature parsing error" };
  }

  return { valid: true };
}