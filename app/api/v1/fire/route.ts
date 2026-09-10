import { NextResponse } from "next/server";
import { resolveApiContext } from "../_lib/context";
import { fireToKitchen } from "@/lib/services/fire-to-kitchen";
import type { FireRequest, FireResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/fire — send the cart to the kitchen: upsert an open check + insert
// station-split kitchen_tickets. NO orders row, NO tender, NO charge — the
// money-independent half of the order lifecycle (Register -> KDS).
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;

  let body: FireRequest;
  try {
    body = (await req.json()) as FireRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: { code: "bad_request", message: "items[] is required." } } satisfies ApiError, { status: 400 });
  }

  const res = await fireToKitchen(ctx.supabase, {
    businessId: ctx.businessId,
    staffId: ctx.staff?.id ?? null,
    createdBy: ctx.userId,
    ticketId: body.ticketId ?? null,
    elementId: body.elementId ?? null,
    label: body.label ?? null,
    ticketType: body.ticketType ?? null,
    channel: body.channel ?? null,
    guestCount: body.guestCount ?? null,
    items: body.items.map((i) => ({
      catalog_item_id: i.catalog_item_id ?? null,
      name: String(i.name ?? "Item"),
      unit_price: Number(i.unit_price) || 0,
      quantity: Number(i.quantity) || 0,
      note: i.note ?? null,
      seat: i.seat ?? null,
      allergy: i.allergy ?? null,
    })),
  });
  if ("error" in res) {
    return NextResponse.json({ error: { code: "server_error", message: res.error } } satisfies ApiError, { status: 500 });
  }

  return NextResponse.json(res satisfies FireResponse);
}
