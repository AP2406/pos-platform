// lib/services/finix.ts
// Server-only Finix service layer. Do NOT import into client components.

const SANDBOX_BASE = "https://finix.sandbox-payments-api.com";
const LIVE_BASE = "https://finix.live-payments-api.com";
const FINIX_VERSION = "2022-02-01";

export function getFinixEnvironment(): string {
  const env = process.env.FINIX_ENVIRONMENT || "sandbox";
  return env === "live" ? "live" : "sandbox";
}

export function getFinixBaseUrl(): string {
  return getFinixEnvironment() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

export function isFinixConfigured(): boolean {
  return Boolean(
    process.env.FINIX_API_USERNAME &&
    process.env.FINIX_API_PASSWORD &&
    process.env.FINIX_APPLICATION_ID
  );
}

function getAuthHeader(): string {
  const user = process.env.FINIX_API_USERNAME || "";
  const pass = process.env.FINIX_API_PASSWORD || "";
  const encoded = Buffer.from(user + ":" + pass).toString("base64");
  return "Basic " + encoded;
}

export type FinixResult = { ok: boolean; status: number; data: any };

export async function finixFetch(path: string, init?: RequestInit): Promise<FinixResult> {
  const url = getFinixBaseUrl() + path;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Finix-Version": FINIX_VERSION,
    "Authorization": getAuthHeader(),
  };

  if (init && init.headers) {
    const extra = init.headers as Record<string, string>;
    for (const key in extra) {
      headers[key] = extra[key];
    }
  }

  const res = await fetch(url, {
    method: (init && init.method) || "GET",
    headers: headers,
    body: init && init.body ? init.body : undefined,
    cache: "no-store",
  });

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }
  }

  return { ok: res.ok, status: res.status, data: data };
}

// Proves credentials work by fetching your platform Application.
export async function pingFinix(): Promise<FinixResult> {
  const appId = process.env.FINIX_APPLICATION_ID || "";
  if (!appId) {
    return { ok: false, status: 0, data: { error: "FINIX_APPLICATION_ID not set" } };
  }
  return finixFetch("/applications/" + appId);
}