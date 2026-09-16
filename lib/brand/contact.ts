// How someone reaches a human at Surge.
//
// These were hardcoded in eight places (the marketing layout, /contact, the
// booking wizard, two pilot forms, the JSON-LD block, the paused-account screen
// and the login page's support link). The address is now in one place, because
// the moment a WhatsApp number joined it there were two things to keep in sync
// instead of one, and the next change would have missed a file.

/** The inbox. Branded rather than personal, and the address SPF is configured for. */
export const CONTACT_EMAIL = "info@surgetechpos.com";

/** Billing questions from a suspended account go somewhere different. */
export const BILLING_EMAIL = "billing@surgetechpos.com";

/**
 * WhatsApp, in the two forms a page needs: one to read, one to link.
 *
 * The link form is digits only with the country code and no punctuation —
 * wa.me rejects spaces, dashes and a leading +, and fails by showing the
 * visitor an error page rather than by failing at build time.
 */
export const WHATSAPP_DISPLAY = "+1 437 669 5723";
export const WHATSAPP_E164 = "14376695723";
export const WHATSAPP_HREF = "https://wa.me/" + WHATSAPP_E164;

/**
 * Prefilled first message. A visitor who taps through from the access screen
 * arrives in a chat with nothing to say and usually says nothing, so the
 * message says it for them.
 */
export const WHATSAPP_PILOT_HREF =
  WHATSAPP_HREF + "?text=" + encodeURIComponent("Hi — I'd like access to the Surge pilot programme.");

/**
 * What someone is told when they reach the end of the open door and find it
 * shut. One constant because the screen and the server action have to say the
 * same thing — a screen that invites you to apply and an action that answers
 * "forbidden" is how a deliberate lock reads as a bug.
 *
 * It lives HERE and not in app/onboarding/actions.ts for a reason worth
 * remembering: a "use server" module may only export async functions. Adding
 * one `export const` to that file did not fail loudly — it made the module
 * export NOTHING, so `createBusiness` vanished and the build failed pointing at
 * the import site rather than the cause.
 */
export const PILOT_ONLY_MESSAGE =
  "Surge is invitation-only while the pilot programme runs. Get in touch and we'll set you up.";
