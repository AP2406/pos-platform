import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";

// Deliverect provider: per-merchant config, outbound order-status callbacks, and
// menu push. Money-INDEPENDENT — Deliverect channel orders arrive PRE-PAID, so we
// only accept + fire + report status. Nothing here charges, tenders, or refunds.
//
// ┌─ CREDS BOUNDARY ────────────────────────────────────────────────────────────┐
// │ Every outbound call is gated on a per-merchant Deliverect token stored in    │
// │ business_integrations(provider='deliverect').access_token. Until that token  │
// │ exists these functions NO-OP and report `skipped` — the same graceful        │
// │ degradation the rest of lib/services/delivery.ts uses (and the printing      │
// │ no-op). Drop in the sandbox token and they go live with no code change.      │
// └─────────────────────────────────────────────────────────────────────────────┘

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", any>;

export const DELIVERECT_API_BASE = process.env.DELIVERECT_API_BASE || "https://api.deliverect.com";

export type DeliverectConfig = {
  locationId: string | null; // Deliverect location/channel id for this business
  token: string | null; // per-merchant API token (decrypted); null = not connected
  active: boolean;
};

// Config lives in business_integrations (same table/pattern as Square). Falls back
// to the legacy businesses.settings.deliverect_location_id used by the inbound
// webhook so existing setups keep resolving.
export async function getDeliverectConfig(supabase: Sb, businessId: string): Promise<DeliverectConfig> {
  const { data: row } = await supabase
    .from("business_integrations")
    .select("access_token, location_id, is_active")
    .eq("business_id", businessId)
    .eq("provider", "deliverect")
    .maybeSingle();

  let token: string | null = null;
  if (row?.access_token) {
    try {
      token = decryptSecret(row.access_token as string);
    } catch {
      token = null; // unreadable secret → treat as not connected
    }
  }
  let locationId = (row?.location_id as string | null) ?? null;
  if (!locationId) {
    const { data: biz } = await supabase.from("businesses").select("settings").eq("id", businessId).maybeSingle();
    const s = (biz?.settings ?? {}) as { deliverect_location_id?: unknown };
    locationId = s.deliverect_location_id ? String(s.deliverect_location_id) : null;
  }
  return { locationId, token, active: row ? (row.is_active as boolean | null) !== false : false };
}

// THE creds gate: outbound calls only fire when a merchant token is connected.
export function deliverectReady(cfg: DeliverectConfig): boolean {
  return !!cfg.token && cfg.active;
}

// ---- Order status ------------------------------------------------------------
// Deliverect channel-order status codes. VERIFY these against your sandbox before
// go-live — Deliverect documents them per environment. Safe to ship unverified:
// the sender no-ops until a token is configured, so a wrong code cannot leak.
export const DELIVERECT_STATUS = {
  ACCEPTED: 20,
  PREPARING: 50,
  READY: 70,
  CANCELED: 100,
} as const;

export type OurFulfillmentOp = "accept" | "preparing" | "ready" | "cancel";

export function mapStatus(op: OurFulfillmentOp): number {
  switch (op) {
    case "accept":
      return DELIVERECT_STATUS.ACCEPTED;
    case "preparing":
      return DELIVERECT_STATUS.PREPARING;
    case "ready":
      return DELIVERECT_STATUS.READY;
    case "cancel":
      return DELIVERECT_STATUS.CANCELED;
  }
}

export type OutboundResult = { sent: boolean; skipped?: string; status?: number };

// Report an order's status back to Deliverect. No-ops (sent:false + reason) when
// the merchant has no token — never throws into the order flow.
export async function sendDeliverectStatus(supabase: Sb, businessId: string, externalOrderId: string, op: OurFulfillmentOp): Promise<OutboundResult> {
  if (!externalOrderId) return { sent: false, skipped: "no external order id" };
  const cfg = await getDeliverectConfig(supabase, businessId);
  if (!deliverectReady(cfg)) return { sent: false, skipped: "deliverect not connected" };

  const status = mapStatus(op);
  try {
    // LIVE CALL — activates the moment a token exists. Endpoint shape per
    // Deliverect's order-status API; confirm the path against the sandbox.
    const res = await fetch(`${DELIVERECT_API_BASE}/orders/${encodeURIComponent(externalOrderId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ status, timeStamp: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.error("sendDeliverectStatus:", res.status, await res.text().catch(() => ""));
      return { sent: false, skipped: `deliverect ${res.status}`, status };
    }
    return { sent: true, status };
  } catch (e) {
    console.error("sendDeliverectStatus:", e);
    return { sent: false, skipped: "network error", status };
  }
}

// ---- Menu push ---------------------------------------------------------------
// Pure mapper: our catalog → Deliverect's menu shape. Amounts are minor units
// (cents) like the inbound feed. Verify the payload against the sandbox schema.
export type DeliverectMenuItem = { id: string; name: string; price: number; category: string | null; outOfStock?: boolean; description?: string | null };
export type DeliverectMenuProduct = { plu: string; name: string; price: number; description: string | null; category: string; snoozed: boolean };
export type DeliverectMenuPayload = { locationId: string; categories: { name: string; products: string[] }[]; products: DeliverectMenuProduct[] };

export function buildDeliverectMenu(locationId: string, items: DeliverectMenuItem[]): DeliverectMenuPayload {
  const products: DeliverectMenuProduct[] = items.map((i) => ({
    plu: i.id,
    name: i.name,
    price: Math.round((Number(i.price) || 0) * 100), // dollars → cents
    description: i.description ?? null,
    category: i.category || "Menu",
    snoozed: i.outOfStock === true, // 86'd → snoozed on the channel
  }));
  const byCategory = new Map<string, string[]>();
  for (const p of products) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p.plu);
    byCategory.set(p.category, arr);
  }
  return {
    locationId,
    categories: [...byCategory.entries()].map(([name, plus]) => ({ name, products: plus })),
    products,
  };
}

export type MenuPushResult = { pushed: boolean; count: number; skipped?: string };

// Push the active catalog to Deliverect. Creds-gated no-op, like the status sender.
export async function pushDeliverectMenu(supabase: Sb, businessId: string): Promise<MenuPushResult> {
  const cfg = await getDeliverectConfig(supabase, businessId);
  if (!deliverectReady(cfg)) return { pushed: false, count: 0, skipped: "deliverect not connected" };
  if (!cfg.locationId) return { pushed: false, count: 0, skipped: "no deliverect location id" };

  const { data } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, out_of_stock")
    .eq("business_id", businessId)
    .eq("is_active", true);
  const items: DeliverectMenuItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) || "Item",
    price: Number(r.price) || 0,
    category: (r.category as string | null) ?? null,
    outOfStock: (r.out_of_stock as boolean | null) === true,
  }));
  const payload = buildDeliverectMenu(cfg.locationId, items);

  try {
    // LIVE CALL — see the creds boundary note at the top.
    const res = await fetch(`${DELIVERECT_API_BASE}/menus/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("pushDeliverectMenu:", res.status, await res.text().catch(() => ""));
      return { pushed: false, count: payload.products.length, skipped: `deliverect ${res.status}` };
    }
    return { pushed: true, count: payload.products.length };
  } catch (e) {
    console.error("pushDeliverectMenu:", e);
    return { pushed: false, count: payload.products.length, skipped: "network error" };
  }
}
