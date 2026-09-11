// Abuse controls for the three UNAUTHENTICATED marketing forms (/contact,
// /book, /pricing pilot sign-up). Pure logic, no Next imports, so it unit-tests
// without a request.
//
// WHAT IS ACTUALLY AT RISK. All three actions send a confirmation email to a
// user-supplied address from noreply@surgetechpos.com. That is the same sending
// domain the live merchants' receipts and invoices go out on. Anyone who can
// drive those forms in a loop can emit branded, SPF/DKIM-valid mail to arbitrary
// recipients until the domain is blocklisted — and the blast radius of a burnt
// domain is not the marketing site, it is transactional mail for every merchant
// on the platform. So the goal here is not "stop spam", it is "make the sending
// domain expensive to borrow".
//
// HOUSE PATTERN. This mirrors the PIN throttle in app/app/pos/staff-session.ts:
// a { n, until } counter, a fixed window, a freeze once the count is exceeded.
// The one thing that had to change is where the state lives. staff-session keeps
// it in an httpOnly cookie because the thing being throttled is a physical till
// we trust to carry one. A cookie is worthless against this threat — the abuse
// case is a script that simply never sends one back — so the key here is the
// request IP and the state lives in the server process.
//
// HONEST LIMITATION: THIS IS PER-INSTANCE, NOT A DISTRIBUTED LIMIT.
// The map lives in one Node process. This app runs in a single Vercel region,
// but Vercel still scales a route to several concurrent instances under load and
// each one holds its own map, so the real-world ceiling is
// (MAX_SENDS_PER_WINDOW x live instances) rather than MAX_SENDS_PER_WINDOW, and
// a cold start resets a bucket to zero. It raises the cost of bulk abuse by
// orders of magnitude; it is not a guarantee. The upgrade path, if the forms
// ever attract real attention, is to back `consume` with a shared store
// (Upstash/Redis INCR + EXPIRE) behind this exact signature — nothing above this
// module needs to change.

// Five sends per IP per hour, shared across all three forms. Shared on purpose:
// one bucket per form would let a script rotate between them for 3x the mail,
// and it is the sending domain being protected, not any single endpoint. Five is
// well clear of a real visitor (a person who books a demo and then sends a
// contact message has used two) while capping an abusive source at a rate that
// cannot damage domain reputation.
export const MAX_SENDS_PER_WINDOW = 5;
export const WINDOW_SECONDS = 60 * 60;

// LRU ceiling. Bounded so a stream of spoofed X-Forwarded-For values cannot grow
// the map without limit — that would turn the defence into a memory-exhaustion
// bug. At ~80 bytes per entry this caps the map in the low hundreds of KB.
const MAX_TRACKED_KEYS = 5000;

type Bucket = { n: number; resetAt: number };

// Map iterates in insertion order, which is what makes the LRU eviction below a
// one-liner: re-inserting on touch moves a key to the end, so the first key is
// always the least recently used.
const buckets = new Map<string, Bucket>();

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type ThrottleResult = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

/** Read the current state for a key without spending any quota. */
export function peek(key: string, now: number = nowSeconds()): ThrottleResult {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { allowed: true, remaining: MAX_SENDS_PER_WINDOW };
  if (b.n >= MAX_SENDS_PER_WINDOW) return { allowed: false, retryAfterSeconds: b.resetAt - now };
  return { allowed: true, remaining: MAX_SENDS_PER_WINDOW - b.n };
}

/**
 * Spend one unit of quota for `key`. Call this immediately before the first
 * sendEmail, NOT at the top of the action: validation failures must not burn a
 * real visitor's allowance, and a request that never sends mail is not the thing
 * being rationed.
 */
export function consume(key: string, now: number = nowSeconds()): ThrottleResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    touch(key, { n: 1, resetAt: now + WINDOW_SECONDS });
    return { allowed: true, remaining: MAX_SENDS_PER_WINDOW - 1 };
  }

  if (existing.n >= MAX_SENDS_PER_WINDOW) {
    // Do NOT extend resetAt here. A sliding penalty would let a script that
    // keeps hammering also keep a legitimate visitor behind the same NAT locked
    // out indefinitely; a fixed window always drains.
    touch(key, existing);
    return { allowed: false, retryAfterSeconds: existing.resetAt - now };
  }

  existing.n += 1;
  touch(key, existing);
  return { allowed: true, remaining: MAX_SENDS_PER_WINDOW - existing.n };
}

function touch(key: string, bucket: Bucket): void {
  buckets.delete(key);
  buckets.set(key, bucket);
  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  }
}

/** Test seam only — never called in production code. */
export function __resetThrottle(): void {
  buckets.clear();
}

// ----- honeypot -----

// The hidden field's name. Deliberately something a form-filling bot wants:
// "website" is in every naive autofill heuristic, and no Surge form asks a real
// visitor for one, so any value at all is a bot. Kept in one place so the three
// client forms and the three actions cannot drift apart.
export const HONEYPOT_FIELD = "website";

export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ----- minimum fill time -----

// A human cannot read eight fields and type an email address in under three
// seconds. The client stamps the mount time and the action checks the delta.
//
// HONEST LIMITATION: the stamp is client-supplied, so it is forgeable — a bot
// that bothers to send `Date.now() - 10000` walks straight through. It is not a
// gate, it is a filter for the large majority of drive-by bots that post the
// form instantly and never look at the payload, and it costs one number on the
// wire. The rate limit above is the control that does not depend on the client
// being honest.
export const MIN_FILL_MS = 3000;

// Ceiling on how far back a stamp may claim to be, so a bot cannot pin an
// ancient timestamp and a real visitor who left a tab open overnight is not
// punished for it (an implausible stamp is ignored, not rejected).
const MAX_FILL_MS = 12 * 60 * 60 * 1000;

export function isTooFast(startedAt: unknown, now: number = Date.now()): boolean {
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return false;
  const elapsed = now - startedAt;
  if (elapsed < 0 || elapsed > MAX_FILL_MS) return false; // implausible stamp — ignore it
  return elapsed < MIN_FILL_MS;
}
