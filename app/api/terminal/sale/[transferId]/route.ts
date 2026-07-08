import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTerminalContext } from "@/lib/services/finix-terminal-context";
import { getTerminalTransfer } from "@/lib/services/finix-terminal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/terminal/sale/:transferId — proxy the transfer's current state so the
// register can poll it. Returns { state, failure_code, failure_message, card }.
export async function GET(_req: Request, ctx: { params: Promise<{ transferId: string }> }) {
  const { transferId } = await ctx.params;

  const tctx = await resolveTerminalContext();
  if (!tctx.ok) {
    return NextResponse.json({ error: tctx.message, reason: tctx.reason }, { status: 409 });
  }

  // Authorize: if we have a payment row for this transfer, it must belong to the
  // caller's business. (Rows are created by our own sale endpoint.)
  const admin = createAdminClient();
  const { data: fp } = await admin
    .from("finix_payments")
    .select("business_id")
    .eq("finix_transfer_id", transferId)
    .maybeSingle();
  if (fp && fp.business_id && fp.business_id !== tctx.businessId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const res = await getTerminalTransfer(transferId);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }
  const t = res.transfer;
  return NextResponse.json({
    state: t.state,
    failure_code: t.failureCode,
    failure_message: t.failureMessage,
    card: t.card,
  });
}
