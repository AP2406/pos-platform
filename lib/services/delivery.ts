import { createHmac, timingSafeEqual } from "crypto";

// GAP-1 (4/5): third-party delivery aggregation helpers.
//   • Inbound orders arrive at /api/integrations/delivery/<platform> and are
//     injected as paid orders by the inject_delivery_order RPC.
//   • Outbound sync (86 an item, push the menu, pause the store) lives here and
//     DEGRADES GRACEFULLY: with no platform credentials configured it is a no-op
//     that logs intent, so nothing breaks before a restaurant connects a platform.
//
// Per-platform API calls require a merchant-specific OAuth token obtained during
// that platform's onboarding (which needs developer credentials we gate on). Until
// those exist the outbound functions report `configured:false` and do nothing.

// Deliverect is middleware: it aggregates Uber Eats / DoorDash / Skip into ONE
// normalized channel-order feed, so a single adapter covers all of them.
export type DeliveryPlatform = "doordash" | "ubereats" | "grubhub" | "deliverect";
export const DELIVERY_PLATFORMS: DeliveryPlatform[] = ["doordash", "ubereats", "grubhub", "deliverect"];

export function isDeliveryPlatform(p: string): p is DeliveryPlatform {
  return (DELIVERY_PLATFORMS as string[]).includes(p);
}

// Env credential presence per platform (developer-app level). Per-merchant tokens
// are a separate onboarding step layered on top of these.
export function deliveryPlatformConfigured(platform: DeliveryPlatform): boolean {
  if (platform === "doordash") return !!process.env.DOORDASH_DEVELOPER_ID && !!process.env.DOORDASH_KEY_ID && !!process.env.DOORDASH_SIGNING_SECRET;
  if (platform === "ubereats") return !!process.env.UBEREATS_CLIENT_ID && !!process.env.UBEREATS_CLIENT_SECRET;
  if (platform === "grubhub") return !!process.env.GRUBHUB_CLIENT_ID && !!process.env.GRUBHUB_CLIENT_SECRET;
  if (platform === "deliverect") return !!process.env.DELIVERECT_WEBHOOK_SECRET;
  return false;
}

function platformWebhookSecret(platform: DeliveryPlatform): string {
  if (platform === "doordash") return process.env.DOORDASH_SIGNING_SECRET || "";
  if (platform === "ubereats") return process.env.UBEREATS_WEBHOOK_SECRET || "";
  if (platform === "grubhub") return process.env.GRUBHUB_WEBHOOK_SECRET || "";
  if (platform === "deliverect") return process.env.DELIVERECT_WEBHOOK_SECRET || "";
  return "";
}

// ---- Deliverect inbound adapter -------------------------------------------------
// Maps a Deliverect channel-order webhook to the normalized shape the inbound
// route injects. Field names are read DEFENSIVELY (Deliverect versions vary):
// verify against a real sandbox order before go-live. Amounts are integer minor
// units (cents) in Deliverect → divided to dollars here. Business is NOT taken
// from the payload — the route resolves it from the Deliverect location id below.
export type NormalizedDeliveryOrder = {
  external_id: string;
  display_id: string | null;
  items: { name: string; quantity: number; unit_price: number; note: string | null }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  location_ref: string | null;
};

function cents(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : Math.round(n) / 100;
}

export function mapDeliverectOrder(raw: unknown): NormalizedDeliveryOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const externalId = String(o.channelOrderId ?? o._id ?? o.orderId ?? "");
  if (!externalId) return null;
  const rawItems = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  const items = rawItems.map((it) => ({
    name: String(it.name ?? it.productName ?? "Item"),
    quantity: Number(it.quantity) || 1,
    unit_price: cents(it.price ?? it.unitPrice ?? 0),
    note: it.remark ? String(it.remark) : it.note ? String(it.note) : null,
  }));
  const payment = (o.payment ?? {}) as Record<string, unknown>;
  return {
    external_id: externalId,
    display_id: o.channelOrderDisplayId ? String(o.channelOrderDisplayId) : null,
    items,
    subtotal: o.productsTotal != null ? cents(o.productsTotal) : null,
    tax: o.taxTotal != null ? cents(o.taxTotal) : o.tax != null ? cents(o.tax) : null,
    total: o.orderTotal != null ? cents(o.orderTotal) : payment.amount != null ? cents(payment.amount) : null,
    // The Deliverect location/channel-link that maps to a Surge business.
    location_ref: (o.location ?? o.locationId ?? o.channelLinkId ?? o.account ?? null) as string | null,
  };
}

// Verify an inbound webhook's HMAC-SHA256 signature against the platform's signing
// secret. Returns {verified:false, configured:false} when no secret is set so the
// route can decide whether to accept unverified test traffic in non-prod.
export function verifyDeliverySignature(
  platform: DeliveryPlatform,
  rawBody: string,
  signatureHeader: string | null
): { verified: boolean; configured: boolean; reason?: string } {
  const secret = platformWebhookSecret(platform);
  if (!secret) return { verified: false, configured: false, reason: "no signing secret configured" };
  if (!signatureHeader) return { verified: false, configured: true, reason: "missing signature header" };
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHeader.trim().toLowerCase(), "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { verified: false, configured: true, reason: "signature mismatch" };
  } catch {
    return { verified: false, configured: true, reason: "signature parse error" };
  }
  return { verified: true, configured: true };
}

export type SyncResult = { platform: DeliveryPlatform; configured: boolean; pushed: boolean; note?: string };

// Mark an item available/unavailable on each connected platform (86-sync). No-op +
// log when a platform isn't configured. Fire-and-forget from the catalog toggle.
export async function notifyPlatforms86(
  businessId: string,
  itemName: string,
  unavailable: boolean
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const platform of DELIVERY_PLATFORMS) {
    const configured = deliveryPlatformConfigured(platform);
    if (!configured) {
      results.push({ platform, configured: false, pushed: false });
      continue;
    }
    // TODO(go-live): call the platform's item-availability API with the merchant
    // token. Until per-merchant onboarding exists, log intent and report not pushed.
    console.info(`[delivery] would set "${itemName}" ${unavailable ? "86'd" : "available"} on ${platform} for business ${businessId}`);
    results.push({ platform, configured: true, pushed: false, note: "merchant not connected" });
  }
  return results;
}

// Pause / resume new orders from connected platforms (e.g. during a rush). Same
// graceful-degrade contract as notifyPlatforms86.
export async function setPlatformsPaused(businessId: string, paused: boolean): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const platform of DELIVERY_PLATFORMS) {
    const configured = deliveryPlatformConfigured(platform);
    if (configured) console.info(`[delivery] would ${paused ? "pause" : "resume"} orders on ${platform} for business ${businessId}`);
    results.push({ platform, configured, pushed: false, note: configured ? "merchant not connected" : undefined });
  }
  return results;
}
