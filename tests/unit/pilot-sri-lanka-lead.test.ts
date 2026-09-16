import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// WHAT THIS FILE PINS, AND WHY IT EXISTS
//
// /pilot/sri-lanka posts to `submitPilot`, the SAME server action /pricing
// posts to, rather than to an endpoint of its own. That was a security
// decision (see the schema comment in app/(marketing)/actions.ts): a second
// unauthenticated write path would sit outside the honeypot, outside
// `isTooFast` and outside the shared per-IP send bucket, on a domain that also
// carries merchant receipts.
//
// Sharing one action has its own failure mode, which is what this file guards:
//
//   1. The widened schema must not change the Canadian lead. The new fields are
//      all optional, and a /pricing submission that sends none of them must
//      produce the same email it produced before — no empty rows, no dashes, no
//      provenance block, no tag in the subject.
//
//   2. `segment` reaches the SUBJECT LINE of mail sent from our own sending
//      domain. It is a zod enum for that reason. If it ever widens to a plain
//      string, an anonymous caller picks our subject lines — so the rejection
//      of an off-list value is asserted here rather than left to review.
//
//   3. The lead-email contract from the hotfix still applies to this page: if
//      the OWNER'S copy does not leave the building, the visitor gets no
//      receipt and the action reports failure.
//
// `sendEmail` is mocked at module level: these tests must never be able to send
// mail, to any address, under any failure mode.

vi.hoisted(() => {
  process.env.SURGE_LEADS_EMAIL = "leads-test@surge.invalid";
  process.env.SURGE_SUPPORT_EMAIL = "support-test@surge.invalid";
});

const LEADS_TO = "leads-test@surge.invalid";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/services/email", () => ({
  sendEmail: mocks.sendEmail,
  isEmailConfigured: mocks.isEmailConfigured,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.77" }),
}));

import { submitPilot } from "@/app/(marketing)/actions";
import { __resetThrottle } from "@/lib/services/form-throttle";

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

/** The lead email is the FIRST send — the visitor receipt is the second. */
function leadCall() {
  return mocks.sendEmail.mock.calls[0][0] as {
    to: string;
    subject: string;
    html: string;
  };
}

const LK_LEAD = {
  businessName: "Galle Road Kade",
  contactName: "Nimal",
  email: "nimal@example.com",
  phone: "",
  businessType: "Cafe",
  locations: "1",
  currentPos: "",
  painPoint: "Queues at lunch.",
  city: "Colombo",
  whatsapp: "+94 77 123 4567",
  country: "LK" as const,
  segment: "sri-lanka-pilot" as const,
  onboarding: "remote" as const,
};

describe("submitPilot — Sri Lanka provenance", () => {
  it("carries the new fields into the owner's email and tags the subject", async () => {
    mocks.sendEmail.mockResolvedValue({ id: "resend-1" });

    const res = await submitPilot(LK_LEAD);
    expect(res.ok).toBe(true);

    const lead = leadCall();
    expect(lead.to).toBe(LEADS_TO);

    // The tag is what the owner filters the inbox on.
    expect(lead.subject).toBe("Surge pilot sign-up [Sri Lanka]: Galle Road Kade (Cafe)");

    // Every new field has to actually reach the person who answers the lead.
    expect(lead.html).toContain("+94 77 123 4567");
    expect(lead.html).toContain("Colombo");
    expect(lead.html).toContain("sri-lanka-pilot");
    expect(lead.html).toContain("LK");
    expect(lead.html).toContain("remote");

    // The standing reminder rides with the lead, because the reply is written
    // at a ten-hour offset by whoever is awake.
    expect(lead.html).toContain("Onboarding is remote");
    expect(lead.html).toMatch(/Do not quote a rate/);
  });

  it("leaves a /pricing lead exactly as it was — no empty rows, no tag", async () => {
    mocks.sendEmail.mockResolvedValue({ id: "resend-2" });

    const res = await submitPilot({
      businessName: "Pilot Bakery",
      contactName: "Alex Pilot",
      email: "pilot-visitor@example.com",
      phone: "",
      businessType: "Bakery",
      locations: "",
      currentPos: "",
      painPoint: "",
    });
    expect(res.ok).toBe(true);

    const lead = leadCall();
    expect(lead.subject).toBe("Surge pilot sign-up: Pilot Bakery (Bakery)");
    expect(lead.subject).not.toContain("Sri Lanka");

    // The provenance block is omitted wholesale rather than rendered as dashes.
    expect(lead.html).not.toContain("Source:");
    expect(lead.html).not.toContain("Country:");
    expect(lead.html).not.toContain("Onboarding:");
    expect(lead.html).not.toContain("WhatsApp:");
    expect(lead.html).not.toContain("City:");
    expect(lead.html).not.toContain("Sri Lanka pilot lead");
  });

  it("refuses an off-list segment, so the subject line stays ours", async () => {
    mocks.sendEmail.mockResolvedValue({ id: "resend-3" });

    const res = await submitPilot({
      ...LK_LEAD,
      // A free-text segment would be interpolated into the subject of mail sent
      // from our own sending domain.
      segment: "anything\nBcc: attacker@example.com" as unknown as "sri-lanka-pilot",
    });

    expect(res.ok).toBe(false);
    // Nothing was sent at all — the parse fails before the send quota is spent.
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an off-list country and onboarding mode", async () => {
    mocks.sendEmail.mockResolvedValue({ id: "resend-4" });

    const badCountry = await submitPilot({
      ...LK_LEAD,
      country: "US" as unknown as "LK",
    });
    expect(badCountry.ok).toBe(false);

    const badOnboarding = await submitPilot({
      ...LK_LEAD,
      onboarding: "in-person" as unknown as "remote",
    });
    expect(badOnboarding.ok).toBe(false);

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("still reports failure and sends no receipt when the lead email fails", async () => {
    // The hotfix contract, asserted for this page's own path.
    mocks.sendEmail.mockResolvedValue({ error: "Resend rejected the sender" });

    const res = await submitPilot(LK_LEAD);

    expect(res.ok).toBe(false);
    expect(res.error).toContain("could not send");
    // Exactly one attempt: the owner's copy. The visitor receipt is never
    // reached, so nobody is told we have a sign-up we do not have.
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0].to).toBe(LEADS_TO);
  });
});
