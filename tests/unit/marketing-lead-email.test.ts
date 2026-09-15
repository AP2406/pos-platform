import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// WHAT THIS FILE PINS, AND WHY IT EXISTS
//
// `sendEmail` does not throw. It returns `{ error }` and logs (see
// lib/services/email.ts). For a while `submitBooking` and `submitContact`
// guarded it with a bare try/catch and returned `{ ok: true }` regardless — so
// when the owner's lead copy was rejected, the catch never fired, the visitor
// got a "we have your request" receipt anyway, and the form reported success.
// That shipped, and a real client was confirmed for a booking the owner never
// received.
//
// The contract below is the fix, stated as a test: if the OWNER'S copy does not
// leave the building, the visitor is NOT sent a receipt and the action reports
// failure. It is asserted for all three forms because the bug was a divergence
// between them — pilot was right and the other two were not, and nothing but a
// test stops that drifting back.
//
// `sendEmail` is mocked at module level: these tests must never be able to send
// mail, to any address, under any failure mode.

vi.hoisted(() => {
  // Set before the action module is evaluated — LEADS_TO and SUPPORT_EMAIL are
  // read once at import time. Deliberately NOT the info@surgetechpos.com
  // default: the log line has to carry the *resolved* address, and a test that
  // passed against a hardcoded default would prove nothing. `.invalid` is
  // reserved by RFC 2606, so these can never resolve even if a mock leaked.
  process.env.SURGE_LEADS_EMAIL = "leads-test@surge.invalid";
  process.env.SURGE_SUPPORT_EMAIL = "support-test@surge.invalid";
});

const LEADS_TO = "leads-test@surge.invalid";
const SUPPORT_EMAIL = "support-test@surge.invalid";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/services/email", () => ({
  sendEmail: mocks.sendEmail,
  isEmailConfigured: mocks.isEmailConfigured,
}));

// The actions read the client IP off request headers for the throttle key.
// There is no request here, so give them a stable one.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.42" }),
}));

import { submitBooking, submitContact, submitPilot } from "@/app/(marketing)/actions";
import { __resetThrottle } from "@/lib/services/form-throttle";

type Form = {
  /** The name that must appear in the log line, i.e. the exported action name. */
  name: string;
  run: () => Promise<{ ok: boolean; error?: string }>;
  /** Address the visitor receipt goes to — must differ from LEADS_TO. */
  visitor: string;
};

const FORMS: Form[] = [
  {
    name: "submitBooking",
    visitor: "booking-visitor@example.com",
    run: () =>
      submitBooking({
        name: "Dana Booking",
        email: "booking-visitor@example.com",
        business: "Dana's Cafe",
        phone: "",
        businessType: "Cafe",
        volume: "$5k - $20k",
        volumeExact: "",
        avgTicket: "$15 - $50",
        paymentMix: "Mostly in person",
        interest: "",
        preferred: "",
        message: "",
      }),
  },
  {
    name: "submitContact",
    visitor: "contact-visitor@example.com",
    run: () =>
      submitContact({
        name: "Sam Contact",
        email: "contact-visitor@example.com",
        phone: "",
        message: "Do you support split bills?",
      }),
  },
  {
    name: "submitPilot",
    visitor: "pilot-visitor@example.com",
    run: () =>
      submitPilot({
        businessName: "Pilot Bakery",
        contactName: "Alex Pilot",
        email: "pilot-visitor@example.com",
        phone: "",
        businessType: "Bakery",
        locations: "",
        currentPos: "",
        painPoint: "",
      }),
  },
];

let errorSpy: ReturnType<typeof vi.spyOn>;
let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  __resetThrottle();
  mocks.sendEmail.mockReset();
  mocks.isEmailConfigured.mockReturnValue(true);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  infoSpy.mockRestore();
});

function loggedLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((args: unknown[]) => args.map((a) => String(a)).join(" "));
}

describe.each(FORMS)("$name — lead email failure", (form) => {
  it("does not send the visitor confirmation and reports failure", async () => {
    // Lead send is rejected; anything after it would succeed. If a confirmation
    // goes out here, the regression is back.
    mocks.sendEmail
      .mockResolvedValueOnce({ error: "simulated Resend failure" })
      .mockResolvedValue({ ok: true, id: "should-never-be-used" });

    const res = await form.run();

    expect(res.ok).toBe(false);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe(LEADS_TO);
    // The one call that happened was the lead, not a receipt to the visitor.
    const recipients = mocks.sendEmail.mock.calls.map((c: [{ to: string }]) => c[0].to);
    expect(recipients).not.toContain(form.visitor);
  });

  it("tells the visitor to email support directly", async () => {
    mocks.sendEmail.mockResolvedValue({ error: "simulated Resend failure" });
    const res = await form.run();
    expect(res.error).toBeTruthy();
    expect(res.error).toContain(SUPPORT_EMAIL);
  });

  it("logs the form, the resolved lead address and the Resend message", async () => {
    // Vercel Hobby keeps runtime logs for one hour. This line is the only
    // forensic record the owner will ever have, so all three facts must be in
    // it — a line missing the address cannot distinguish a misconfigured
    // SURGE_LEADS_EMAIL from a rejected send.
    mocks.sendEmail.mockResolvedValue({ error: "simulated Resend failure" });

    await form.run();

    const line = loggedLines(errorSpy).find((l) => l.includes("[" + form.name + "]"));
    expect(line, "no console.error line tagged [" + form.name + "]").toBeTruthy();
    expect(line).toContain(LEADS_TO);
    expect(line).toContain("simulated Resend failure");
    expect(line).toContain("lead email");
  });
});

describe.each(FORMS)("$name — lead email success", (form) => {
  it("sends the confirmation only after the lead is accepted, in that order", async () => {
    mocks.sendEmail
      .mockResolvedValueOnce({ ok: true, id: "lead-id-1" })
      .mockResolvedValueOnce({ ok: true, id: "conf-id-2" });

    const res = await form.run();

    expect(res.ok).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe(LEADS_TO);
    expect(mocks.sendEmail.mock.calls[1][0].to).toBe(form.visitor);
  });

  it("logs both sends at info with their Resend ids", async () => {
    // The id is what lets a missing lead be matched against the Resend
    // dashboard — i.e. "we never sent it" told apart from "Resend took it and
    // the mailbox dropped it", which have completely different fixes.
    mocks.sendEmail
      .mockResolvedValueOnce({ ok: true, id: "lead-id-1" })
      .mockResolvedValueOnce({ ok: true, id: "conf-id-2" });

    await form.run();

    const lines = loggedLines(infoSpy).filter((l) => l.includes("[" + form.name + "]"));
    const lead = lines.find((l) => l.includes("lead email"));
    const conf = lines.find((l) => l.includes("confirmation email"));

    expect(lead, "no info line for the lead send").toBeTruthy();
    expect(lead).toContain(LEADS_TO);
    expect(lead).toContain("lead-id-1");

    expect(conf, "no info line for the confirmation send").toBeTruthy();
    expect(conf).toContain("conf-id-2");
  });

  it("still succeeds when only the confirmation fails, and logs that", async () => {
    // Best-effort is deliberate and must stay: the lead is already in the
    // owner's inbox, and failing the submission over a receipt would throw away
    // the thing we actually wanted.
    mocks.sendEmail
      .mockResolvedValueOnce({ ok: true, id: "lead-id-1" })
      .mockResolvedValueOnce({ error: "receipt bounced" });

    const res = await form.run();

    expect(res.ok).toBe(true);
    const line = loggedLines(errorSpy).find((l) => l.includes("confirmation email"));
    expect(line, "a failed receipt must still be logged").toBeTruthy();
    expect(line).toContain("receipt bounced");
  });
});

describe("sendEmail throwing is treated as a failed lead, never a sent one", () => {
  // sendEmail catches its own exceptions today. That is an implementation
  // detail, not a contract we control, and the whole bug was trusting an
  // assumption about how this function signals failure.
  it.each(FORMS)("$name reports failure and sends no receipt", async (form) => {
    mocks.sendEmail.mockRejectedValue(new Error("socket hang up"));

    const res = await form.run();

    expect(res.ok).toBe(false);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    const line = loggedLines(errorSpy).find((l) => l.includes("[" + form.name + "]"));
    expect(line).toContain(LEADS_TO);
  });
});
