import { NextResponse } from "next/server";
import { resolveApiContext } from "../_lib/context";
import type { SessionResponse } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/session — the RN app calls this on launch to confirm its token +
// X-Surge-Business / X-Surge-Staff headers resolve to the expected business and
// staff before it rings anything. Pure read; no money logic.
export async function GET(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;
  const body: SessionResponse = {
    user: { id: ctx.userId, email: ctx.userEmail },
    business: { id: ctx.businessId, name: ctx.businessName },
    staff: ctx.staff,
  };
  return NextResponse.json(body);
}
