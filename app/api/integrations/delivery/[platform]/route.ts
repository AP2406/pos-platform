import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isDeliveryPlatform, verifyDeliverySignature, type DeliveryPlatform } from "@/lib/services/delivery";
import { integrationEnabled } from "@/lib/services/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GAP-1 (4/5): inbound delivery webhook. Each platform POSTs an order here; we
// inject it as a paid order tagged by channel (inject_delivery_order). The body is
// expected in a NORMALISED shape — a per-platform adapter that maps the native
// payload to this shape is the remaining work once that platform's developer
// credentials + store mapping exist; the shape below is what our test harness and
// future adapters produce:
//   { business_id, external_id, display_id?, items:[{name, quantity, unit_price?, note?}],
//     subtotal?, tax?, total? }

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  return json({ ok: true, service: "delivery-webhook", platform }, 200);
}

export async function POST(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  if (!isDeliveryPlatform(platform)) return json({ error: "unknown platform" }, 404);
  const plat = platform as DeliveryPlatform;

  const rawBody = await req.text();

  // Signature: verify against the platform's signing secret when configured. In
  // production a configured-but-invalid signature is rejected; with no secret set
  // we accept (so sandbox/test orders work) but warn.
  const sig = req.headers.get("x-delivery-signature") || req.headers.get("x-signature");
  const check = verifyDeliverySignature(plat, rawBody, sig);
  if (check.configured && !check.verified) {
    console.error(`delivery webhook ${plat}: signature invalid (${check.reason})`);
    return json({ error: "invalid signature" }, 401);
  }
  if (!check.configured) {
    console.warn(`delivery webhook ${plat}: no signing secret set — accepting unverified. Set one in production.`);
  }

  let body: { business_id?: string; external_id?: string; display_id?: string; items?: { name?: string; quantity?: number; unit_price?: number; note?: string }[]; subtotal?: number; tax?: number; total?: number } | null = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return json({ ok: true, note: "non-json body ignored" }, 200);
  }
  if (!body || !body.business_id || !body.external_id || !Array.isArray(body.items)) {
    return json({ error: "missing business_id, external_id, or items" }, 400);
  }

  const admin = getAdmin();
  if (!admin) {
    console.error("delivery webhook: Supabase admin client unavailable (missing SUPABASE_SERVICE_ROLE_KEY).");
    return json({ ok: false, note: "storage unavailable" }, 503);
  }

  // Only ingest when the business has the delivery connector enabled.
  const { data: biz } = await admin.from("businesses").select("settings").eq("id", body.business_id).maybeSingle();
  if (!biz) return json({ error: "unknown business" }, 404);
  if (!integrationEnabled((biz as { settings?: unknown }).settings, "delivery")) {
    return json({ ok: true, note: "delivery connector disabled for business" }, 200);
  }

  const items = body.items.map((i) => ({ name: i.name ?? "Item", quantity: i.quantity ?? 1, unit_price: i.unit_price ?? 0, note: i.note ?? null }));
  const { data, error } = await admin.rpc("inject_delivery_order", {
    p_business_id: body.business_id,
    p_platform: plat,
    p_external_id: body.external_id,
    p_display_id: body.display_id ?? null,
    p_items: items,
    p_subtotal: body.subtotal ?? 0,
    p_tax: body.tax ?? 0,
    p_total: body.total ?? 0,
  });
  if (error) {
    console.error(`delivery webhook ${plat}: inject failed`, error);
    return json({ ok: false, error: "ingest failed" }, 500);
  }
  return json({ ok: true, result: data }, 200);
}
