// Startup env contract. In PRODUCTION a missing production-required secret is a
// hard failure (throws, so a misconfigured deploy never boots serving traffic).
// In dev/sandbox everything is soft — missing vars only warn — so local work and
// sandbox testing stay flexible. Called once from instrumentation.ts.

// Core infra the app genuinely cannot run without — a miss here throws at boot.
// Kept minimal on purpose: only Supabase, without which nothing works (and which
// is always set in any working deploy). Deliberately excludes Finix (a payments
// misconfig must not take down the Pearson tenant), the canonical hosts (the code
// has its own https://www.surgetechpos.com fallbacks), and CRON_SECRET (enforced
// at the cron routes in STEP 4, not at boot) — crashing the whole deploy over
// those would cause an outage worse than the misconfig.
const PRODUCTION_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

// Should be set in production, but warn (loudly) rather than crash the deploy:
// the hosts have code fallbacks and CRON_SECRET is enforced at the route.
const PROD_WARN = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "CRON_SECRET"] as const;

// Required to take real cards, but enforced at the payment routes (webhook +
// getCardConfig fail closed), not at boot. Missing in production warns LOUDLY so
// it's caught, without crashing a deploy that also serves non-payment tenants.
const PAYMENTS_REQUIRED = [
  "FINIX_USERNAME",
  "FINIX_PASSWORD",
  "FINIX_APPLICATION_ID",
  "FINIX_WEBHOOK_SIGNING_KEY",
] as const;

// Nice-to-have / feature-gated. Missing = that feature degrades or fails closed
// at its own route; never a boot failure.
const DEV_OPTIONAL = [
  "FINIX_ENVIRONMENT",
  "FINIX_MERCHANT_ID",
  "FINIX_DEVICE_ID",
  "RESEND_API_KEY",
  "VAPID_PRIVATE_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DELIVERY_DOORDASH_SIGNING_SECRET",
  "DELIVERY_UBEREATS_SIGNING_SECRET",
  "DELIVERY_SKIP_SIGNING_SECRET",
] as const;

function isSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const missingRequired = PRODUCTION_REQUIRED.filter((n) => !isSet(n));
  const missingPayments = PAYMENTS_REQUIRED.filter((n) => !isSet(n));
  const missingOptional = DEV_OPTIONAL.filter((n) => !isSet(n));

  if (isProd && missingRequired.length > 0) {
    // Throwing here aborts server startup — the deploy fails loudly rather than
    // serving traffic with, e.g., no service-role key or an unprotected cron.
    throw new Error(
      "Missing required production environment variables: " +
        missingRequired.join(", ") +
        ". Set them (see .env.example) and redeploy."
    );
  }

  if (missingRequired.length > 0) {
    console.warn(
      "[env] Missing (dev): " + missingRequired.join(", ") + " — some features will be unavailable."
    );
  }
  const missingProdWarn = PROD_WARN.filter((n) => !isSet(n));
  if (missingProdWarn.length > 0) {
    console.warn(
      (isProd ? "[env] PRODUCTION: " : "[env] ") +
        "recommended vars not set: " +
        missingProdWarn.join(", ") +
        " (hosts fall back to www.surgetechpos.com; CRON_SECRET is checked at the cron routes)."
    );
  }
  if (missingPayments.length > 0) {
    // Loud in production, but not fatal — card routes fail closed on their own,
    // and a Finix miss must not take down the non-payment (Pearson) tenant.
    console.warn(
      (isProd ? "[env] PRODUCTION: " : "[env] ") +
        "card processing not configured — missing: " +
        missingPayments.join(", ") +
        ". Card/terminal payments will be disabled."
    );
  }
  if (missingOptional.length > 0) {
    console.warn("[env] Optional not set: " + missingOptional.join(", ") + ".");
  }
}
