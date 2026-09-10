import { NextResponse } from "next/server";
import { resolveApiContext } from "../_lib/context";
import { clockToggleCore, breakToggleCore } from "@/lib/services/time-clock";
import type { ClockRequest, ClockResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/clock — the acting staff clocks themselves in/out or toggles a
// break. Staff state, NOT money.
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;
  if (!ctx.staff) return NextResponse.json({ error: { code: "bad_request", message: "No acting staff on this request." } } satisfies ApiError, { status: 400 });

  let body: ClockRequest;
  try {
    body = (await req.json()) as ClockRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }

  const res =
    body.op === "break"
      ? await breakToggleCore(ctx.supabase, ctx.businessId, ctx.staff.id)
      : await clockToggleCore(ctx.supabase, ctx.businessId, ctx.staff.id);
  if ("error" in res) return NextResponse.json({ error: { code: "server_error", message: res.error } } satisfies ApiError, { status: 500 });

  return NextResponse.json(res satisfies ClockResponse);
}
