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
  const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString(
    "base64"
  );
  return `Basic ${encoded}`;
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

  const url = `${FINIX_API_BASE}${path}`;

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
      console.error(`Finix ${method} ${path} failed:`, response.status, data);
      return {
        error: `Finix API error (${response.status})`,
        status: response.status,
        details: data,
      };
    }

    return { ok: true, data: data as T };
  } catch (err) {
    console.error(`Finix ${method} ${path} exception:`, err);
    return { error: "Finix request failed. Check network or credentials." };
  }
}

export const finix = {
  get: <T>(path: string) => finixRequest<T>("GET", path),
  post: <T>(path: string, body: unknown) => finixRequest<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => finixRequest<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) =>
    finixRequest<T>("PATCH", path, body),
  delete: <T>(path: string) => finixRequest<T>("DELETE", path),
};