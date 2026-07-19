import { API_BASE_URL } from "./config";
import { supabase } from "./supabase";
import { notify } from "./notice";
import {
  API_HEADERS,
  type SessionResponse,
  type ApprovalsVerifyRequest,
  type ApprovalsVerifyResponse,
  type QuoteRequest,
  type QuoteResponse,
  type KdsOp,
  type KdsMutateResponse,
  type OrdersFulfillOp,
  type OrdersFulfillResponse,
  type FireRequest,
  type FireResponse,
  type ClockOp,
  type ClockResponse,
  type ReservationInput,
  type ReservationCreateResponse,
  type ReservationMutateRequest,
  type ReservationMutateResponse,
  type TicketAppendRequest,
  type TicketAppendResponse,
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

// One place to fetch + parse the v1 envelope. On failure it surfaces a brief,
// non-blocking top notice (see NoticeHost) AND throws so callers still degrade.
async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    notify("Can't reach the Surge API — some actions are unavailable.");
    throw new Error("Network request failed");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    // 404 here means the v1 routes aren't deployed on the configured API host.
    notify(res.status === 404 ? "Surge API isn't available on this server yet." : msg);
    throw new Error(msg);
  }
  return json as T;
}

// GET /api/v1/session — confirm token + headers resolve to the expected business/staff.
export async function getSession(businessId: string, staffId?: string | null): Promise<SessionResponse> {
  return send<SessionResponse>(`${API_BASE_URL}/api/v1/session`, {
    headers: await authHeaders(businessId, staffId),
  });
}

// POST /api/v1/approvals/verify — verify-only (no money moves).
export async function verifyApprovals(
  businessId: string,
  staffId: string | null,
  body: ApprovalsVerifyRequest
): Promise<ApprovalsVerifyResponse> {
  return send<ApprovalsVerifyResponse>(`${API_BASE_URL}/api/v1/approvals/verify`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// POST /api/v1/quote — Subtotal / Tax / Total for a cart. Compute-only (no write).
export async function quote(
  businessId: string,
  staffId: string | null,
  body: QuoteRequest
): Promise<QuoteResponse> {
  return send<QuoteResponse>(`${API_BASE_URL}/api/v1/quote`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// POST /api/v1/kds/:id — bump (fired->ready) / recall (ready->fired). Kitchen
// state, not money.
export async function kdsMutate(businessId: string, staffId: string | null, ticketId: string, op: KdsOp): Promise<KdsMutateResponse> {
  return send<KdsMutateResponse>(`${API_BASE_URL}/api/v1/kds/${ticketId}`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify({ op }),
  });
}

// POST /api/v1/orders/:id/fulfill — Orders-hub Mark-ready / Reopen. Fulfillment
// state (+ order-ready email on "ready"), not money.
export async function ordersFulfill(businessId: string, staffId: string | null, orderId: string, op: OrdersFulfillOp): Promise<OrdersFulfillResponse> {
  return send<OrdersFulfillResponse>(`${API_BASE_URL}/api/v1/orders/${orderId}/fulfill`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify({ op }),
  });
}

// POST /api/v1/fire — send the cart to the kitchen (open check + kitchen tickets).
// Money-independent: no orders row, no tender, no charge.
export async function fire(businessId: string, staffId: string | null, body: FireRequest): Promise<FireResponse> {
  return send<FireResponse>(`${API_BASE_URL}/api/v1/fire`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// POST /api/v1/clock — the acting staff clocks in/out (op "toggle") or toggles a
// break (op "break"). Staff state, not money.
export async function clockToggle(businessId: string, staffId: string | null, op: ClockOp): Promise<ClockResponse> {
  return send<ClockResponse>(`${API_BASE_URL}/api/v1/clock`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify({ op }),
  });
}

// POST /api/v1/reservations — create a booking or walk-in waitlist entry. FOH state.
export async function createReservation(businessId: string, staffId: string | null, body: ReservationInput): Promise<ReservationCreateResponse> {
  return send<ReservationCreateResponse>(`${API_BASE_URL}/api/v1/reservations`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// POST /api/v1/reservations/:id — advance status (seat/cancel/no-show/done) or
// page a waitlisted guest. FOH state, not money.
export async function reservationMutate(businessId: string, staffId: string | null, id: string, body: ReservationMutateRequest): Promise<ReservationMutateResponse> {
  return send<ReservationMutateResponse>(`${API_BASE_URL}/api/v1/reservations/${id}`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// POST /api/v1/tickets/append — move an item to another table's open check.
// Order shaping (no kitchen ticket, no tender).
export async function appendToTicket(businessId: string, staffId: string | null, body: TicketAppendRequest): Promise<TicketAppendResponse> {
  return send<TicketAppendResponse>(`${API_BASE_URL}/api/v1/tickets/append`, {
    method: "POST",
    headers: await authHeaders(businessId, staffId),
    body: JSON.stringify(body),
  });
}

// NOTE: order / tender / refund / tab money-write calls are intentionally absent —
// they wait for the shared money-write endpoints, which are deferred until the
// live $1 txn+refund test clears.
