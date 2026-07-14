// Surge v1 HTTP API contracts — §2 of the Native iOS POS blueprint.
// One source of truth for the request/response shapes shared by the web Route
// Handlers and the React Native client. Type-only: no runtime code, so the web
// build erases these imports entirely.
//
// Transport (every /api/v1 route):
//   Authorization: Bearer <supabase access token>   -> resolves the user
//   X-Surge-Business: <businessId>                   -> active location (membership-verified)
//   X-Surge-Staff: <staffId>                         -> acting POS-PIN identity (verified active)
//   Idempotency-Key: <uuid>                          -> required on money writes
//
// Money-WRITE endpoints (orders / tender / refund / tabs) are intentionally NOT
// declared here yet — they stay deferred until the live $1 txn+refund test clears.
// This v1 slice ships the transport envelope, the read model, and the
// verify-only approvals contract.

export const API_HEADERS = {
  business: "X-Surge-Business",
  staff: "X-Surge-Staff",
  idempotency: "Idempotency-Key",
} as const;

// Standard error envelope for every route.
export type ApiError = {
  error: {
    code:
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "bad_request"
      | "conflict"
      | "server_error";
    message: string;
  };
};

// Resolved caller context echoed by GET /api/v1/session (lets the RN app confirm
// its token + headers resolve to the right business/staff before ringing anything).
export type SessionResponse = {
  user: { id: string; email: string | null };
  business: { id: string; name: string };
  staff: { id: string; name: string; role: string } | null;
};

// ---- Approvals (verify-only; no money moves) --------------------------------
// Mirrors verifyInSaleApprovals: re-derives the cashier's own authority and, for
// anything they can't do, requires a manager PIN. Returns the approver or the
// list of still-blocked action labels.

export type SensitiveActionInput = {
  present: boolean;
  label: string;
  permKey: string | null;
  amount: number | null;
};

export type ApprovalsVerifyRequest = {
  isTraining?: boolean;
  approverPin?: string;
  actions: SensitiveActionInput[];
};

export type ApprovalsVerifyResponse =
  | { approver: { id: string; name: string } | null }
  | { blocked: string[] };

// ---- Quote (compute-only; no writes, no charge) -----------------------------
// Returns Subtotal / Tax / Total for a cart using the canonical shared tax math
// (computeCartTax) so the native register shows totals that match the eventual
// charge exactly. Pure computation — nothing is persisted.

export type QuoteItemInput = {
  catalog_item_id?: string | null;
  unit_price: number;
  quantity: number;
};

export type QuoteRequest = { items: QuoteItemInput[] };

export type QuoteResponse = {
  subtotal: number;
  tax: number;
  total: number;
  taxBreakdown: { label: string; rate: number; base: number; amount: number }[];
};

// ---- Role-based native access (navigation gating; NOT security) -------------
// RLS remains the real data boundary; this only decides which native surfaces a
// role/device sees + where they land. Config lives in businesses.settings.native_access.
export type Surface = "floor" | "register" | "kds" | "sales" | "orders";
export type DeviceHome = "pos" | "kds";
export type NativeRoleAccess = { surfaces: Surface[]; home: Surface };
export type NativeAccessConfig = Record<string, NativeRoleAccess>; // keyed by role key

// ---- KDS (kitchen state; NOT money) -----------------------------------------
// Bump = fired -> ready (set fulfilled_at); recall = ready -> fired (clear it).
export type KdsOp = "bump" | "recall";
export type KdsMutateRequest = { op: KdsOp };
export type KdsMutateResponse = { ok: true };

// ---- Order fulfillment (Orders hub; kitchen state, NOT money) ----------------
// ready = mark fulfilled (+ order-ready email/SMS); reopen = clear fulfilled_at.
export type OrdersFulfillOp = "ready" | "reopen";
export type OrdersFulfillRequest = { op: OrdersFulfillOp };
export type OrdersFulfillResponse = { ok: true };

// ---- Fire to kitchen (create/persist open check + kitchen tickets; NOT money) --
// Sends the cart to the kitchen: upserts an open_ticket and inserts station-split
// kitchen_tickets. No orders row, no tender, no charge — the money-independent
// half of the order lifecycle.
export type FireItemInput = {
  catalog_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  note?: string | null;
  seat?: number | null;
  allergy?: string | null; // per-line guest allergy alert (red on the KDS)
};
export type FireRequest = {
  ticketId?: string | null; // existing open check to resume, else a new one is created
  elementId?: string | null; // table this check belongs to
  label?: string | null; // display label (e.g. "Table 5" / "Online · Ana")
  ticketType?: string | null; // "table" | "togo" | "bar" | ...
  channel?: string | null; // e.g. "dine_in"
  guestCount?: number | null;
  items: FireItemInput[];
};
export type FireResponse = { ticketId: string; fired: number };

// ---- Time clock (staff state; NOT money) ------------------------------------
// The acting staff (X-Surge-Staff) clocks themselves in/out or toggles a break.
// No PIN re-entry (context already verified the staff) and no schedule
// enforcement — self-service on the staff member's own device.
export type ClockOp = "toggle" | "break";
export type ClockRequest = { op: ClockOp };
export type ClockShift = { onShift: boolean; onBreak: boolean; since: string | null; onBreakSince: string | null };
export type ClockResponse = ClockShift & { action: "in" | "out" | "break_start" | "break_end"; name: string };

// ---- Reservations + waitlist (front-of-house state; NOT money) ---------------
// One table holds future bookings (scheduledAt set) and walk-in waitlist entries
// (scheduledAt null). Create preserves the confirmation email; "page" preserves
// the table-ready SMS/email. No money anywhere.
export type ReservationInput = {
  guestName: string;
  partySize: number;
  phone?: string | null;
  email?: string | null;
  scheduledAt?: string | null; // ISO, or null/empty = walk-in waitlist
  quotedWaitMin?: number | null;
  notes?: string | null;
};
export type ReservationRow = {
  id: string;
  guestName: string;
  partySize: number;
  phone: string | null;
  email: string | null;
  scheduledAt: string | null;
  quotedWaitMin: number | null;
  elementId: string | null;
  status: string; // booked | waitlisted | seated | cancelled | no_show | done
  notes: string | null;
  pagedAt: string | null;
};
export type ReservationCreateResponse = { reservation: ReservationRow; warning: string | null };
export type ReservationStatus = "booked" | "waitlisted" | "seated" | "cancelled" | "no_show" | "done";
export type ReservationMutateRequest =
  | { op: "status"; status: ReservationStatus; elementId?: string | null }
  | { op: "page" };
export type ReservationMutateResponse = { ok: true; channel?: "sms" | "email" };
