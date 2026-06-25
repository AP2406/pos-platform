import { isFinixConfigured, getFinixConfig } from "./finix";
import { isEmailConfigured } from "./email";
import { isSmsConfigured } from "./sms";

// P2 external-integration registry. Each connector reports whether its server
// credentials are present (env), what env vars it needs, and a finish-up
// checklist. Per-business enablement lives on businesses.settings.integrations.<key>.
// Everything degrades gracefully when not configured — nothing here activates a
// connector or sends data on its own.

export type IntegrationKey =
  | "finix_cards" | "bar_tab" | "qbo" | "xero" | "settlement" | "delivery" | "reservations_sync" | "messaging";

export type IntegrationStatus = {
  key: IntegrationKey;
  label: string;
  group: "Payments" | "Accounting" | "Delivery" | "Reservations" | "Messaging";
  description: string;
  configured: boolean; // server credentials present
  detail: string | null; // e.g. "sandbox" / "live"
  envVars: string[];
  checklist: string[];
};

function envPresent(...names: string[]): boolean {
  return names.every((n) => !!process.env[n]);
}

export function integrationStatuses(): IntegrationStatus[] {
  const finix = isFinixConfigured();
  const finixEnv = finix ? getFinixConfig().environment : null;

  return [
    {
      key: "finix_cards",
      label: "Card payments (Finix)",
      group: "Payments",
      description: "Terminal + card-not-present charges, card refunds, and closed-check tip adjust through Finix.",
      configured: finix,
      detail: finixEnv,
      envVars: ["FINIX_USERNAME", "FINIX_PASSWORD", "FINIX_APPLICATION_ID", "FINIX_MERCHANT_ID", "FINIX_ENVIRONMENT"],
      checklist: [
        "Add Finix API credentials to the server environment (env vars listed).",
        "Set FINIX_ENVIRONMENT=sandbox to test, then live for production.",
        "Complete Finix merchant underwriting; set FINIX_MERCHANT_ID.",
        "Enable below, then run a $1 sandbox sale + refund from the register.",
      ],
    },
    {
      key: "bar_tab",
      label: "Bar-tab pre-authorization (Finix)",
      group: "Payments",
      description: "Open a tab with a card hold, add rounds, capture at close with tip; release the hold if abandoned.",
      configured: finix,
      detail: finixEnv,
      envVars: ["(uses Finix card credentials)"],
      checklist: [
        "Requires Card payments (Finix) configured + enabled.",
        "Enable below; the bar tab uses pre-auth/capture on the same Finix merchant.",
      ],
    },
    {
      key: "qbo",
      label: "QuickBooks Online",
      group: "Accounting",
      description: "OAuth sync that posts the daily summary journal entry (with your COA mapping) on day-close.",
      configured: envPresent("QBO_CLIENT_ID", "QBO_CLIENT_SECRET"),
      detail: null,
      envVars: ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET", "QBO_REDIRECT_URI"],
      checklist: [
        "Create a QuickBooks Online app; add client id/secret to the server env.",
        "Set the redirect URI to /api/integrations/qbo/callback.",
        "Connect your QBO company via the button (OAuth), then map accounts under Chart of accounts.",
        "Enable; day-close will post a DSJE (deduped per day).",
      ],
    },
    {
      key: "xero",
      label: "Xero",
      group: "Accounting",
      description: "OAuth sync that posts the daily summary journal entry (with your COA mapping) on day-close.",
      configured: envPresent("XERO_CLIENT_ID", "XERO_CLIENT_SECRET"),
      detail: null,
      envVars: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI"],
      checklist: [
        "Create a Xero app; add client id/secret to the server env.",
        "Set the redirect URI to /api/integrations/xero/callback.",
        "Connect your Xero org via the button (OAuth), then map accounts under Chart of accounts.",
        "Enable; day-close will post a manual journal (deduped per day).",
      ],
    },
    {
      key: "settlement",
      label: "Finix settlement reconciliation",
      group: "Payments",
      description: "Pull Finix settlements/payouts and reconcile gross → fees → net deposit, with variance flags.",
      configured: finix,
      detail: finixEnv,
      envVars: ["(uses Finix credentials)"],
      checklist: [
        "Requires Card payments (Finix) configured.",
        "Enable; the reconciliation report pulls settlement batches for the period.",
      ],
    },
    {
      key: "delivery",
      label: "Third-party delivery (Uber Eats / DoorDash)",
      group: "Delivery",
      description: "Inject delivery orders onto the KDS tagged by platform; they roll into reports by channel.",
      configured: envPresent("UBEREATS_CLIENT_ID") || envPresent("DOORDASH_DEVELOPER_ID"),
      detail: null,
      envVars: ["UBEREATS_CLIENT_ID", "UBEREATS_CLIENT_SECRET", "DOORDASH_DEVELOPER_ID", "DOORDASH_KEY_ID", "DOORDASH_SIGNING_SECRET"],
      checklist: [
        "Create developer apps with Uber Eats and/or DoorDash; add credentials to the server env.",
        "Set the webhook/callback URLs to /api/integrations/delivery/<platform>.",
        "Connect each platform via OAuth; enable below.",
        "Send a test order from the platform sandbox — it should appear on the KDS tagged.",
      ],
    },
    {
      key: "messaging",
      label: "SMS (Twilio)",
      group: "Messaging",
      description: "Send real texts: waitlist 'table ready' paging + SMS marketing campaigns. Falls back to email until configured.",
      configured: isSmsConfigured(),
      detail: null,
      envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"],
      checklist: [
        "Create a Twilio account + a messaging-capable phone number.",
        "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM to the server env.",
        "Enable; waitlist paging + Marketing → Text (SMS) start sending real messages.",
      ],
    },
    {
      key: "reservations_sync",
      label: "OpenTable / Resy",
      group: "Reservations",
      description: "Two-way sync of bookings with OpenTable/Resy. Optional — in-app reservations work standalone.",
      configured: envPresent("OPENTABLE_CLIENT_ID") || envPresent("RESY_API_KEY"),
      detail: null,
      envVars: ["OPENTABLE_CLIENT_ID", "OPENTABLE_CLIENT_SECRET", "RESY_API_KEY"],
      checklist: [
        "Obtain partner API access from OpenTable and/or Resy (approval required).",
        "Add credentials to the server env; connect via the button.",
        "Enable; bookings sync both ways.",
      ],
    },
  ];
}

// GAP-0: app-wide environment essentials surfaced on the Integrations page so an
// operator can see at a glance what's configured. Server-side only (reads env).
export function envEssentials(): { label: string; ok: boolean; env: string }[] {
  return [
    { label: "Card processing (Finix)", ok: isFinixConfigured(), env: "FINIX_*" },
    { label: "Email (Resend)", ok: isEmailConfigured(), env: "RESEND_API_KEY" },
    { label: "SMS (Twilio)", ok: isSmsConfigured(), env: "TWILIO_*" },
    { label: "Scheduled jobs", ok: !!process.env.CRON_SECRET, env: "CRON_SECRET" },
    { label: "Public links (booking, online order)", ok: !!process.env.NEXT_PUBLIC_SITE_URL, env: "NEXT_PUBLIC_SITE_URL" },
  ];
}

// Per-business enablement (settings.integrations.<key>), default off.
export function integrationEnabled(settings: unknown, key: IntegrationKey): boolean {
  const map = (settings as { integrations?: Record<string, unknown> } | null)?.integrations ?? {};
  return map[key] === true;
}
