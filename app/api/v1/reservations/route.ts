import { NextResponse } from "next/server";
import { resolveApiContext } from "../_lib/context";
import { createReservationCore } from "@/lib/services/reservations";
import type { ReservationInput, ReservationCreateResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/reservations — create a booking (scheduledAt set) or a walk-in
// waitlist entry (scheduledAt null). Preserves the booking confirmation email.
// Front-of-house state, NOT money.
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;

  let body: ReservationInput;
  try {
    body = (await req.json()) as ReservationInput;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }

  const res = await createReservationCore(ctx.supabase, {
    businessId: ctx.businessId,
    guestName: String(body.guestName ?? ""),
    partySize: Number(body.partySize) || 1,
    phone: body.phone ?? null,
    email: body.email ?? null,
    scheduledAt: body.scheduledAt ?? null,
    quotedWaitMin: body.quotedWaitMin ?? null,
    notes: body.notes ?? null,
  });
  if ("error" in res) return NextResponse.json({ error: { code: "bad_request", message: res.error } } satisfies ApiError, { status: 400 });

  return NextResponse.json(res satisfies ReservationCreateResponse);
}
