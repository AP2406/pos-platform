import { NextResponse } from "next/server";
import { resolveApiContext } from "../../_lib/context";
import type { KdsMutateRequest, KdsMutateResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/kds/:id — bump (fired -> ready) / recall (ready -> fired) a kitchen
// ticket. Kitchen state, NOT money. Writes via the caller's RLS-scoped client and
// audits recalls, mirroring the web actions.
// NOTE: B10 auto-course release runs in the money-adjacent pos/ticket-actions and
// is intentionally NOT invoked here yet (that file stays untouched until the live
// $1 test); the web KDS still runs it. Bump is otherwise complete.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: { code: "bad_request", message: "Missing ticket id." } } satisfies ApiError, { status: 400 });
  }

  let body: KdsMutateRequest;
  try {
    body = (await req.json()) as KdsMutateRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }
  if (body?.op !== "bump" && body?.op !== "recall") {
    return NextResponse.json({ error: { code: "bad_request", message: "op must be 'bump' or 'recall'." } } satisfies ApiError, { status: 400 });
  }

  if (body.op === "bump") {
    const { error } = await ctx.supabase
      .from("kitchen_tickets")
      .update({ fulfilled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", ctx.businessId);
    if (error) {
      return NextResponse.json({ error: { code: "server_error", message: "Could not bump the ticket." } } satisfies ApiError, { status: 500 });
    }
  } else {
    const { error } = await ctx.supabase
      .from("kitchen_tickets")
      .update({ fulfilled_at: null })
      .eq("id", id)
      .eq("business_id", ctx.businessId);
    if (error) {
      return NextResponse.json({ error: { code: "server_error", message: "Could not recall the ticket." } } satisfies ApiError, { status: 500 });
    }
    // Audit the recall (matches the web recallKitchenTicket).
    await ctx.supabase.from("audit_events").insert({
      business_id: ctx.businessId,
      actor_id: ctx.userId,
      action: "kds_recall",
      metadata: { ticket_id: id, kind: "kitchen", via: "native", staff_id: ctx.staff?.id ?? null },
    });
  }

  return NextResponse.json({ ok: true } satisfies KdsMutateResponse);
}
