// Finix in-person (PAX) terminal helpers — server-side cloud API.
// Sales are pushed to an activated device; the terminal wakes and prompts for
// tap/insert. All calls reuse the shared `finix` client (Basic auth,
// Finix-Version 2022-02-01) — credentials never reach the client.
//
// Docs: https://docs.finix.com/guides/in-person-payments/building-your-integration/pos-integration

import { finix, isFinixConfigured, finixErrorMessage } from "./finix";

// Resolve the device to push to: the location's own device, else the env
// default (the single currently-activated terminal). Returns null when neither
// is set — callers surface "no terminal configured".
export function resolveDeviceId(businessDeviceId: string | null | undefined): string | null {
  return (businessDeviceId && String(businessDeviceId)) || process.env.FINIX_DEVICE_ID || null;
}

export function isTerminalConfigured(businessDeviceId: string | null | undefined): boolean {
  return isFinixConfigured() && !!resolveDeviceId(businessDeviceId);
}

export type TerminalTransferState = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";

export type TerminalTransfer = {
  id: string;
  state: TerminalTransferState;
  amountCents: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  card: { brand: string | null; last4: string | null } | null;
};

type RawTransfer = {
  id?: string;
  state?: string;
  amount?: number;
  currency?: string;
  failure_code?: string | null;
  failure_message?: string | null;
  // Card-present transfers surface the tapped card under a few possible fields
  // depending on Finix version; read them all defensively.
  card_brand?: string;
  masked_account_number?: string;
  last_four?: string;
  payment_instrument?: { card_brand?: string; brand?: string; last_four?: string; masked_account_number?: string };
  _embedded?: { payment_instruments?: { card_brand?: string; brand?: string; last_four?: string; masked_account_number?: string }[] };
};

function last4(s: string | null | undefined): string | null {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function normalizeState(s: string | undefined): TerminalTransferState {
  const u = String(s || "").toUpperCase();
  if (u === "PENDING" || u === "SUCCEEDED" || u === "FAILED") return u;
  if (u === "CANCELED" || u === "CANCELLED") return "CANCELED";
  return "UNKNOWN";
}

function extractCard(t: RawTransfer): { brand: string | null; last4: string | null } | null {
  const pi = t.payment_instrument || t._embedded?.payment_instruments?.[0] || {};
  const brand = t.card_brand || pi.card_brand || pi.brand || null;
  const l4 = last4(t.last_four || t.masked_account_number || pi.last_four || pi.masked_account_number || null);
  if (!brand && !l4) return null;
  return { brand: brand ? String(brand) : null, last4: l4 };
}

function toTerminalTransfer(t: RawTransfer): TerminalTransfer {
  return {
    id: String(t.id || ""),
    state: normalizeState(t.state),
    amountCents: typeof t.amount === "number" ? t.amount : 0,
    currency: t.currency || "CAD",
    failureCode: t.failure_code || null,
    failureMessage: t.failure_message || null,
    card: extractCard(t),
  };
}

export type TerminalSaleResult =
  | { ok: true; transfer: TerminalTransfer }
  | { error: string; code: string | null };

// Push a card-present sale to the device. Returns the transfer (PENDING) whose
// id the client then polls. `amountCents` is integer cents.
export async function createTerminalSale(args: {
  amountCents: number;
  deviceId: string;
  idempotencyId: string;
  tags?: Record<string, string>;
}): Promise<TerminalSaleResult> {
  // Device sales don't take a `merchant` — the device already belongs to one.
  const body: Record<string, unknown> = {
    amount: args.amountCents,
    currency: "CAD",
    device: args.deviceId,
    operation_key: "CARD_PRESENT_SALE",
    idempotency_id: args.idempotencyId,
    tags: { source: "surge-pos", ...(args.tags || {}) },
  };
  const res = await finix.post<RawTransfer>("/transfers", body);
  if ("error" in res) {
    const { code, message } = finixErrorMessage(res);
    // The terminal being off/asleep/unplugged comes back as DEVICE_UNREACHABLE.
    if (code === "DEVICE_UNREACHABLE") {
      return { error: "The terminal isn't responding. Check that it's on, connected, and awake, then try again.", code };
    }
    return { error: message || "Could not start the sale on the terminal. Please try again.", code: code };
  }
  return { ok: true, transfer: toTerminalTransfer(res.data) };
}

export async function getTerminalTransfer(
  transferId: string
): Promise<{ ok: true; transfer: TerminalTransfer } | { error: string }> {
  const res = await finix.get<RawTransfer>("/transfers/" + transferId);
  if ("error" in res) return { error: res.error };
  return { ok: true, transfer: toTerminalTransfer(res.data) };
}

// Cancel whatever prompt is active on the device (customer walked away, wrong
// amount, etc.). Finix: PUT /devices/{id} { action: "CANCEL" }.
export async function cancelTerminalDevice(
  deviceId: string
): Promise<{ ok: true } | { error: string }> {
  const res = await finix.put<{ id?: string }>("/devices/" + deviceId, { action: "CANCEL" });
  if ("error" in res) return { error: res.error };
  return { ok: true };
}

// Device connection status for the "Ready" badge.
// GET /devices/{id}?include_connection=true — connection.status "open" = online.
type RawDevice = {
  id?: string;
  connection?: { status?: string };
  _embedded?: { connection?: { status?: string } };
};

export async function getDeviceConnection(
  deviceId: string
): Promise<{ ok: true; ready: boolean; status: string } | { error: string }> {
  const res = await finix.get<RawDevice>("/devices/" + deviceId + "?include_connection=true");
  if ("error" in res) return { error: res.error };
  const status = String(res.data?.connection?.status || res.data?._embedded?.connection?.status || "").toLowerCase();
  return { ok: true, ready: status === "open", status: status || "unknown" };
}
