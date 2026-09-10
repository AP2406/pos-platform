import { NextResponse } from "next/server";
import { resolveApiContext } from "../../_lib/context";
import { appendLineToTable } from "@/lib/services/ticket-append";
import type { TicketAppendRequest, TicketAppendResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/tickets/append — move an item to another table: append one line to
// the destination table's open check (create it if absent). NO kitchen ticket, NO
// tender — order shaping only.
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;

  let body: TicketAppendRequest;
  try {
    body = (await req.json()) as TicketAppendRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }
  if (!body?.elementId || !body?.item) {
    return NextResponse.json({ error: { code: "bad_request", message: "elementId and item are required." } } satisfies ApiError, { status: 400 });
  }

  const res = await appendLineToTable(ctx.supabase, {
    businessId: ctx.businessId,
    staffId: ctx.staff?.id ?? null,
    elementId: body.elementId,
    label: body.label ?? null,
    item: {
      catalog_item_id: body.item.catalog_item_id ?? null,
      name: String(body.item.name ?? "Item"),
      unit_price: Number(body.item.unit_price) || 0,
      quantity: Number(body.item.quantity) || 0,
      note: body.item.note ?? null,
      seat: body.item.seat ?? null,
    },
  });
  if ("error" in res) return NextResponse.json({ error: { code: "bad_request", message: res.error } } satisfies ApiError, { status: 400 });

  return NextResponse.json(res satisfies TicketAppendResponse);
}
