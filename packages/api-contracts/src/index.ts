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

// ---- Ticket append (move an item to another table's open check; NOT money) ----
// Appends one (unfired) cart line to the destination table's open_ticket, creating
// the check if the table has none. No kitchen ticket, no tender — order shaping.
export type TicketAppendItem = {
  catalog_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  note?: string | null;
  seat?: number | null;
};
export type TicketAppendRequest = { elementId: string; label?: string | null; item: TicketAppendItem };
export type TicketAppendResponse = { ticketId: string };

// ---- Delivery channels (the orders.channel column) --------------------------
// Every value migration 0074 can write to orders.channel for a delivery. It
// normalises any platform it does not recognise to the literal 'delivery', so
// this list is complete by construction.
//
// It lives in the shared package because BOTH the web app and the iPad app
// classify orders, and each used to carry its own copy of this list. All three
// copies were wrong, and wrong differently: a DoorDash order read as "In-store"
// on the reports split, "Other" in the web Orders hub, and "Dine-in" on the iPad
// — the one a server actually looks at mid-service. Screens may keep their own
// bucket models; none of them gets its own opinion about what a delivery is.
//
// Add a platform to 0074's normalisation and add it here. Nowhere else.
export const DELIVERY_CHANNELS: readonly string[] = [
  "doordash",
  "ubereats",
  "grubhub",
  "delivery",
];

/**
 * True when orders.channel holds a delivery.
 *
 * NOT the same question as lib/services/delivery.ts's isDeliveryPlatform, which
 * asks "is this an inbound webhook sender we serve" and answers yes to
 * 'deliverect' — the aggregator that fronts Uber Eats, DoorDash and Skip. That
 * value never reaches orders.channel: 0074 normalises it, like every platform it
 * does not recognise, to the literal 'delivery'. Two different sets, two
 * different jobs; keep the names apart.
 */
export function isDeliveryChannel(channel: string | null | undefined): boolean {
  return DELIVERY_CHANNELS.includes((channel ?? "").toLowerCase().trim());
}

// ---- Money ------------------------------------------------------------------
// Rendering and tendering in the merchant's own currency. See money.ts for why
// this had to exist at all.
export {
  formatMoney,
  currencyDecimals,
  minorUnits,
  cashNotes,
  cashSuggestions,
  CASH_NOTES,
  SUPPORTED_CURRENCIES,
} from "./money";

// ---- Bar stools ---------------------------------------------------------------
// A floor element of kind "seat" is either a chair pulled up to a table or a
// stool at a bar, and the ONLY thing that tells them apart is what it hangs off.
// That matters because the difference decides real behaviour: a stool holds its
// own check and a chair does not, a stool is drawn in a row along one edge and
// a chair wraps four sides, and a stool is a move target and a chair is not.
//
// Three files had started to carry their own copy of this test — the server's
// move-target list, the web floor and the iPad floor — which is precisely how
// DELIVERY_CHANNELS above ended up wrong in three different ways at once. One
// copy, before the drift starts rather than after.
export const STOOL_PARENT_KINDS: readonly string[] = ["counter", "station"];

export function isStoolSeat(
  kind: string | null | undefined,
  parentKind: string | null | undefined
): boolean {
  return kind === "seat" && STOOL_PARENT_KINDS.includes(parentKind ?? "");
}

// ---- Check names (party name, to-go name, bar tab name) ---------------------
// One column, open_tickets.label, holds all three, because a check has one name
// whatever kind of check it is. The normalisation below was copy-pasted into
// four call sites before it lived here; they had already started to drift.

export const CHECK_NAME_MAX = 80;

/**
 * The name a check should be stored under, or null for "no name".
 *
 * Empty and whitespace-only both mean null rather than "": a host who opens the
 * rename dialog and clears the field is removing the name, and a check whose
 * name is the empty string would print a stray separator on every tile that
 * shows it.
 */
export function normalizeCheckName(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  return s ? s.slice(0, CHECK_NAME_MAX) : null;
}

/**
 * The one-line "who is sitting here" for a table tile: "Okafor · 4 guests".
 *
 * Either half may be missing — an unnamed party, or a named one whose size was
 * never entered — and the line is simply the half we know. With neither, it
 * returns "", so the caller drops the line instead of rendering a separator
 * with nothing on either side of it.
 *
 * Shared because the web floor and the iPad floor both draw this line, and the
 * delivery-channel comment above is what happens when they don't share.
 */
export function partySummary(
  name: string | null | undefined,
  guests: number | null | undefined
): string {
  const n = typeof guests === "number" && Number.isFinite(guests) && guests > 0 ? guests : null;
  return [normalizeCheckName(name), n === null ? null : n + (n === 1 ? " guest" : " guests")]
    .filter(Boolean)
    .join(" · ");
}
