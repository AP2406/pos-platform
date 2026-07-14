import { API_BASE_URL } from "./config";
import { supabase } from "./supabase";
import {
  API_HEADERS,
  type SessionResponse,
  type ApprovalsVerifyRequest,
  type ApprovalsVerifyResponse,
  type QuoteRequest,
  type QuoteResponse,
  type KdsOp,
  type KdsMutateResponse,
} from "@surge/api-contracts";

// Typed client for the shared v1 HTTP API. Every call carries the Supabase access
// token + the active business (+ acting staff) as headers — the server verifies
// all three (see app/api/v1/_lib/context.ts). Contract types come from the same
// @surge/api-contracts package the routes use, so the shapes can't drift.

async function authHeaders(businessId: string, staffId?: string | null): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers[API_HEADERS.business] = businessId;
  if (staffId) headers[API_HEADERS.staff] = staffId;
  return headers;
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

// GET /api/v1/session — confirm token + headers resolve to the expected business/staff.
export async function getSession(businessId: string, staffId?: string | null): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/session`, {
    headers: await authHeaders(businessId, staffId),
  });
  return parse<SessionResponse>(res);
}

// POST /api/v1/approvals/verify — verify-only (no money moves).
export async function verifyApprovals(
  businessId: string,
  staffId: string | null,
  body: ApprovalsVerifyRequest
): Promise<ApprovalsVerifyResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/approvals/verify`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
  return parse<ApprovalsVerifyResponse>(res);
}

// POST /api/v1/quote — Subtotal / Tax / Total for a cart. Compute-only (no write).
export async function quote(
  businessId: string,
  staffId: string | null,
  body: QuoteRequest
): Promise<QuoteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/quote`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
  return parse<QuoteResponse>(res);
}

// POST /api/v1/kds/:id — bump (fired->ready) / recall (ready->fired). Kitchen
// state, not money.
export async function kdsMutate(businessId: string, staffId: string | null, ticketId: string, op: KdsOp): Promise<KdsMutateResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/kds/${ticketId}`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify({ op }),
  });
  return parse<KdsMutateResponse>(res);
}

// NOTE: order / tender / refund / tab money-write calls are intentionally absent —
// they wait for the shared money-write endpoints, which are deferred until the
// live $1 txn+refund test clears.
