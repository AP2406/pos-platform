import { describe, it, expect, beforeEach } from "vitest";

// The three marketing forms (/contact, /book, pilot sign-up) are the only
// unauthenticated write path on the site, and each one sends a confirmation to a
// user-supplied address from noreply@surgetechpos.com — the same sending domain
// the live merchants' receipts and invoices go out on. These tests pin the three
// controls that stand between that domain and an open relay, so a later
// refactor that quietly drops one fails here rather than in Postmaster Tools.

import {
  consume,
  peek,
  isHoneypotTripped,
  isTooFast,
  __resetThrottle,
  HONEYPOT_FIELD,
  MAX_SENDS_PER_WINDOW,
  WINDOW_SECONDS,
  MIN_FILL_MS,
} from "@/lib/services/form-throttle";

beforeEach(() => {
  __resetThrottle();
});

describe("per-IP send quota", () => {
  const NOW = 1_800_000_000; // fixed epoch seconds; the module takes `now` as a seam

  it("allows exactly MAX_SENDS_PER_WINDOW sends, then refuses", () => {
    for (let i = 1; i <= MAX_SENDS_PER_WINDOW; i++) {
      const res = consume("203.0.113.7", NOW);
      expect(res.allowed, "send #" + i + " should be allowed").toBe(true);
    }
    const over = consume("203.0.113.7", NOW);
    expect(over.allowed).toBe(false);
    if (!over.allowed) expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts down remaining allowance", () => {
    const first = consume("203.0.113.8", NOW);
    expect(first).toEqual({ allowed: true, remaining: MAX_SENDS_PER_WINDOW - 1 });
  });

  it("buckets are per IP — one abusive source does not lock out another visitor", () => {
    for (let i = 0; i < MAX_SENDS_PER_WINDOW + 3; i++) consume("198.51.100.1", NOW);
    expect(consume("198.51.100.2", NOW).allowed).toBe(true);
  });

  it("the window drains — a fixed window, not a sliding penalty", () => {
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i++) consume("203.0.113.9", NOW);
    expect(consume("203.0.113.9", NOW).allowed).toBe(false);

    // Hammering while locked out must NOT push the reset further away, or a real
    // visitor behind the same NAT would never get back in.
    consume("203.0.113.9", NOW + 10);
    consume("203.0.113.9", NOW + 20);

    expect(consume("203.0.113.9", NOW + WINDOW_SECONDS + 1).allowed).toBe(true);
  });

  it("peek reports state without spending quota", () => {
    consume("203.0.113.10", NOW);
    expect(peek("203.0.113.10", NOW)).toEqual({ allowed: true, remaining: MAX_SENDS_PER_WINDOW - 1 });
    expect(peek("203.0.113.10", NOW)).toEqual({ allowed: true, remaining: MAX_SENDS_PER_WINDOW - 1 });
  });

  it("a missing IP header is a shared bucket, not a bypass", () => {
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i++) consume("unknown", NOW);
    expect(consume("unknown", NOW).allowed).toBe(false);
  });
});

describe("honeypot", () => {
  it("is the field name the client component renders", () => {
    expect(HONEYPOT_FIELD).toBe("website");
  });

  it("trips on any non-blank value", () => {
    expect(isHoneypotTripped("http://spam.example")).toBe(true);
    expect(isHoneypotTripped("x")).toBe(true);
  });

  it("does not trip on the empty/whitespace value a real submission sends", () => {
    expect(isHoneypotTripped("")).toBe(false);
    expect(isHoneypotTripped("   ")).toBe(false);
    expect(isHoneypotTripped(undefined)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped(123)).toBe(false);
  });
});

describe("minimum fill time", () => {
  const NOW = 1_800_000_000_000; // ms

  it("flags a form returned faster than a human could fill it", () => {
    expect(isTooFast(NOW - 200, NOW)).toBe(true);
    expect(isTooFast(NOW - (MIN_FILL_MS - 1), NOW)).toBe(true);
  });

  it("passes a normal human fill", () => {
    expect(isTooFast(NOW - MIN_FILL_MS, NOW)).toBe(false);
    expect(isTooFast(NOW - 45_000, NOW)).toBe(false);
  });

  it("ignores an implausible stamp rather than rejecting the visitor", () => {
    // Tab left open overnight, or a clock-skewed / forged stamp: neither a real
    // person nor a signal we can trust, so the check abstains.
    expect(isTooFast(NOW - 40 * 60 * 60 * 1000, NOW)).toBe(false);
    expect(isTooFast(NOW + 60_000, NOW)).toBe(false);
    expect(isTooFast(undefined, NOW)).toBe(false);
    expect(isTooFast("not-a-number", NOW)).toBe(false);
    expect(isTooFast(Number.NaN, NOW)).toBe(false);
  });
});
