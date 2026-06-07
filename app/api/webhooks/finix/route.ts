import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";

// Webhook verification uses Node's crypto, so force the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FinixTransferEmbedded = {
  id?: string;
  state?: string;
  failure_code?: string;
  failure_message?: string;
};

type FinixEvent = {
  id?: string;
  system_generated_idempotency_id?: string;
  type?: string;
  entity?: string;
  occurred_at?: string;
  _embedded?: { transfers?: FinixTransferEmbedded[] };
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// Verify Finix's "Finix-Signature: timestamp=<epoch>, sig=<hex>" header.
// HMAC-SHA256 over "timestamp:rawBody", signing key used as a UTF-8 string.
function verifyFinixSignature(
  rawBody: string,
  header: string | null,
  signingKey: string
): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "missing Finix-Signature header" };

  let ts = "";
  let sig = "";
  const parts = header.split(",");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k === "timestamp") ts = v;
    else if (k === "sig") sig = v.toLowerCase();
  }
  if (!ts || !sig) return { valid: false, reason: "malformed Finix-Signature header" };

  const eventTime = parseInt(ts, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!eventTime || Math.abs(nowSec - eventTime) > 300) {
    return { valid: false, reason: "timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", signingKey).update(ts + ":" + rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return { valid: false, reason: "signature length mismatch" };
    if (!timingSafeEqual(a, b)) return { valid: false, reason: "signature mismatch" };
  } catch {
    return { valid: false, reason: "signature parse error" };
  }
  return { valid: true };
}

export async function GET() {
  return jsonResponse({ ok: true, service: "finix-webhook" }, 200);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("finix-signature");
  const signingKey = process.env.FINIX_WEBHOOK_SIGNING_KEY || "";

  if (signingKey) {
    const check = verifyFinixSignature(rawBody, sigHeader, signingKey);
    if (!check.valid) {
      console.error("Finix webhook signature invalid: " + (check.reason || ""));
      return jsonResponse({ error: "invalid signature" }, 401);
    }
  } else {
    console.warn("Finix webhook: FINIX_WEBHOOK_SIGNING_KEY not set - accepting unverified. Set this in production.");
  }

  // Parse the body. The empty test event Finix sends when a webhook is first
  // created has no id; respond 200 so Finix enables the webhook.
  let event: FinixEvent | null = null;
  try {
    event = rawBody ? (JSON.parse(rawBody) as FinixEvent) : null;
  } catch {
    return jsonResponse({ ok: true, note: "non-json body ignored" }, 200);
  }
  if (!event || !event.id) {
    return jsonResponse({ ok: true, note: "test or empty event" }, 200);
  }

  const admin = getAdmin();
  if (!admin) {
    console.error("Finix webhook: Supabase admin client unavailable (missing SUPABASE_SERVICE_ROLE_KEY).");
    return jsonResponse({ ok: true, note: "storage unavailable" }, 200);
  }

  // Dedup + log. A duplicate delivery hits the primary-key unique violation.
  const insertRes = await admin
    .from("finix_webhook_events")
    .insert({
      id: event.id,
      idempotency_id: event.system_generated_idempotency_id || null,
      type: event.type || null,
      entity: event.entity || null,
      occurred_at: event.occurred_at || null,
      payload: event,
      processed: false,
    })
    .select("id")
    .maybeSingle();

  if (insertRes.error) {
    const code = (insertRes.error as { code?: string }).code || "";
    if (code === "23505") {
      return jsonResponse({ ok: true, note: "duplicate event" }, 200);
    }
    console.error("Finix webhook: failed to log event " + event.id, insertRes.error);
    return jsonResponse({ ok: true, note: "log failed" }, 200);
  }

  // Process. Transfer state changes keep finix_payments in sync (handles a
  // PENDING charge later settling to SUCCEEDED or flipping to FAILED).
  let processError: string | null = null;
  try {
    if (event.entity === "transfer") {
      const list = event._embedded && event._embedded.transfers ? event._embedded.transfers : [];
      const transfer = Array.isArray(list) && list.length > 0 ? list[0] : null;
      if (transfer && transfer.id) {
        const state = String(transfer.state || "").toLowerCase();
        const { error: updErr } = await admin
          .from("finix_payments")
          .update({
            status: state,
            failure_code: transfer.failure_code || null,
            failure_message: transfer.failure_message || null,
            raw_response: transfer,
          })
          .eq("finix_transfer_id", transfer.id);
        if (updErr) processError = "finix_payments update: " + (updErr.message || "error");
      }
    }
    // Other entities (merchant, dispute, etc.) are logged in
    // finix_webhook_events for now; deeper handling can read from there.
  } catch (e) {
    processError = String(e);
    console.error("Finix webhook: processing error for event " + event.id, e);
  }

  await admin
    .from("finix_webhook_events")
    .update({ processed: processError === null, process_error: processError })
    .eq("id", event.id);

  return jsonResponse({ ok: true }, 200);
}