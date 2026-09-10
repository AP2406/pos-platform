import { NextResponse } from "next/server";
import { resolveApiContext } from "../../../_lib/context";
import { markOrderFulfilledCore, recallOrderCore } from "@/lib/services/order-fulfill";
import type { OrdersFulfillRequest, OrdersFulfillResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/orders/:id/fulfill — Orders-hub Mark-ready / Reopen. Fulfillment /
// kitchen state, NOT money: "ready" sets fulfilled_at + fires the order-ready
// email/SMS (shared core with the web); "reopen" clears it + audits. No tender,
// no charge.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: { code: "bad_request", message: "Missing order id." } } satisfies ApiError, { status: 400 });
  }

  let body: OrdersFulfillRequest;
  try {
    body = (await req.json()) as OrdersFulfillRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }
  if (body?.op !== "ready" && body?.op !== "reopen") {
    return NextResponse.json({ error: { code: "bad_request", message: "op must be 'ready' or 'reopen'." } } satisfies ApiError, { status: 400 });
  }

  let res: { ok: true } | { error: string };
  if (body.op === "ready") {
    const { data: biz } = await ctx.supabase.from("businesses").select("name, settings").eq("id", ctx.businessId).maybeSingle();
    res = await markOrderFulfilledCore(ctx.supabase, { id: ctx.businessId, name: (biz?.name as string | null) ?? null, settings: (biz?.settings as Record<string, unknown> | null) ?? null }, id);
  } else {
    res = await recallOrderCore(ctx.supabase, ctx.businessId, id, ctx.userId);
  }
  if ("error" in res) {
    return NextResponse.json({ error: { code: "server_error", message: res.error } } satisfies ApiError, { status: 500 });
  }

  return NextResponse.json({ ok: true } satisfies OrdersFulfillResponse);
}
