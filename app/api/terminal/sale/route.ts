import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTerminalContext } from "@/lib/services/finix-terminal-context";
import { createTerminalSale } from "@/lib/services/finix-terminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/terminal/sale — push a card-present sale to the location's device.
// Body: { amountCents:int, idempotencyKey?:string, orderId?:string }.
// Returns { transferId } immediately; the client polls GET /api/terminal/sale/:id.
export async function POST(req: Request) {
  let body: { amountCents?: unknown; idempotencyKey?: unknown; orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amountCents = Math.round(Number(body?.amountCents));
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: "Amount must be at least $1.00." }, { status: 400 });
  }
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;

  const ctx = await resolveTerminalContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.message, reason: ctx.reason }, { status: 409 });
  }

  const idempotencyId = "surge-terminal-" + (idempotencyKey || globalThis.crypto.randomUUID());
  const sale = await createTerminalSale({
    amountCents,
    deviceId: ctx.deviceId,
    idempotencyId,
    tags: {
      ...(idempotencyKey ? { idem: idempotencyKey } : {}),
      ...(orderId ? { order_id: orderId } : {}),
    },
  });
  if ("error" in sale) {
    const status = sale.code === "DEVICE_UNREACHABLE" ? 503 : 502;
    return NextResponse.json({ error: sale.error, code: sale.code }, { status });
  }

  // Log a pending payment row (service-role; RLS is members-read-only) linked to
  // the transfer, so the webhook keeps it in sync and finalize can attach the order.
  const admin = createAdminClient();
  await admin
    .from("finix_payments")
    .insert({
      business_id: ctx.businessId,
      order_id: orderId,
      trip_id: null,
      finix_transfer_id: sale.transfer.id,
      finix_payment_instrument_id: null,
      finix_merchant_id: ctx.merchantId,
      amount_cents: sale.transfer.amountCents || amountCents,
      currency: "CAD",
      status: sale.transfer.state.toLowerCase(),
      raw_response: sale.transfer as unknown as Record<string, unknown>,
    })
    .select("id")
    .maybeSingle();

  return NextResponse.json({ transferId: sale.transfer.id, state: sale.transfer.state });
}
