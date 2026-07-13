import { NextResponse } from "next/server";
import { resolveApiContext } from "../../_lib/context";
import { verifyInSaleApprovals, type SensitiveAction } from "@/lib/services/approval-gate";
import type { PermissionKey } from "@/lib/services/permissions";
import type { ApprovalsVerifyRequest, ApprovalsVerifyResponse, ApiError } from "@surge/api-contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/approvals/verify — server-verify in-sale manager approvals for the
// native client. VERIFICATION ONLY: it re-derives the cashier's authority and,
// for anything they can't do, checks the manager PIN — no money moves, nothing is
// written. Thin wrapper over the same verifyInSaleApprovals the web uses, so the
// authority rules stay identical across clients.
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;

  let body: ApprovalsVerifyRequest;
  try {
    body = (await req.json()) as ApprovalsVerifyRequest;
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError,
      { status: 400 }
    );
  }
  if (!Array.isArray(body?.actions)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "actions[] is required." } } satisfies ApiError,
      { status: 400 }
    );
  }

  const actions: SensitiveAction[] = body.actions.map((a) => ({
    present: !!a.present,
    label: String(a.label ?? ""),
    permKey: (a.permKey as PermissionKey | null) ?? null,
    amount: a.amount == null ? null : Number(a.amount),
  }));

  const result = await verifyInSaleApprovals({
    supabase: ctx.supabase,
    businessId: ctx.businessId,
    isStaffed: ctx.staff != null,
    isTraining: body.isTraining === true,
    cashierId: ctx.staff?.id ?? null,
    cashierRole: ctx.staff?.role ?? null,
    approverPin: body.approverPin,
    actions,
  });

  return NextResponse.json(result satisfies ApprovalsVerifyResponse);
}
