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
