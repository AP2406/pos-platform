import { createHmac, timingSafeEqual } from "node:crypto";

// The signed-in cashier cookie. P0 security: the value is HMAC-signed and bound to the
// business, so a scripted client can't forge it to impersonate a higher-privileged
// staff member (every staff id is shipped to the client via staffList, and httpOnly
// only blocks reads — not a client setting its own request header). Attribution and the
// manager-approval gate both derive the cashier's authority from this cookie, so it must
// be unforgeable. Only setActiveStaff (after a verified PIN) can mint a valid value.
export const ACTIVE_STAFF_COOKIE = "surge_active_staff";

// Server-only secret (never shipped to the client). Falls back to empty string, which
// makes every signature verification fail closed (no active staff) rather than trust.
function secret(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "") + "|surge-active-staff-v1";
}

function sign(businessId: string, staffId: string): string {
  return createHmac("sha256", secret()).update(businessId + ":" + staffId).digest("base64url");
}

// Mint the cookie value for a verified cashier: "<staffId>.<sig>".
export function makeActiveStaffCookie(businessId: string, staffId: string): string {
  return staffId + "." + sign(businessId, staffId);
}

// Verify a cookie value against the business and return the staff id, or null if it's
// missing, malformed, or the signature doesn't match (forged / legacy unsigned / wrong
// business). Constant-time compare on the signature.
export function readActiveStaffId(rawValue: string | null | undefined, businessId: string): string | null {
  if (!rawValue) return null;
  const dot = rawValue.lastIndexOf(".");
  if (dot <= 0 || dot >= rawValue.length - 1) return null;
  const staffId = rawValue.slice(0, dot);
  const sig = rawValue.slice(dot + 1);
  const expected = sign(businessId, staffId);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;
  return staffId;
}
