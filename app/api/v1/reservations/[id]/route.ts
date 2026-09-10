import { NextResponse } from "next/server";
import { resolveApiContext } from "../../_lib/context";
import { setReservationStatusCore, pageWaitlistGuestCore } from "@/lib/services/reservations";
import type { ReservationMutateRequest, ReservationMutateResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/reservations/:id — advance a reservation's status (seat / cancel /
// no-show / done) or page a waitlisted guest that their table is ready. The page
// op preserves the table-ready SMS/email. Front-of-house state, NOT money.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;
  const { id } = await params;

  let body: ReservationMutateRequest;
  try {
    body = (await req.json()) as ReservationMutateRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }

  if (body.op === "page") {
    const res = await pageWaitlistGuestCore(ctx.supabase, ctx.businessId, id);
    if ("error" in res) return NextResponse.json({ error: { code: "bad_request", message: res.error } } satisfies ApiError, { status: 400 });
    return NextResponse.json({ ok: true, channel: res.channel } satisfies ReservationMutateResponse);
  }

  if (body.op === "status") {
    const res = await setReservationStatusCore(ctx.supabase, ctx.businessId, id, body.status, body.elementId ?? null);
    if ("error" in res) return NextResponse.json({ error: { code: "bad_request", message: res.error } } satisfies ApiError, { status: 400 });
    return NextResponse.json({ ok: true } satisfies ReservationMutateResponse);
  }

  return NextResponse.json({ error: { code: "bad_request", message: "Unknown op." } } satisfies ApiError, { status: 400 });
}
