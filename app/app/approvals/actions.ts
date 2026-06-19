"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { getActiveStaff } from "../pos/staff-session";
import { notifyBusiness } from "@/lib/push";
import { revalidatePath } from "next/cache";

export type ApprovalRow = {
  id: string;
  kind: string;
  orderId: string | null;
  saleNumber: number | null;
  amount: number | null;
  reasonCode: string | null;
  reasonNote: string | null;
  requestedByName: string | null;
  context: string | null;
  createdAt: string;
};

// A cashier without the permission/cap sends an approval request to the queue
// instead of getting an on-the-spot manager PIN. Best-effort push to managers.
export async function requestApproval(input: {
  kind: "void";
  orderId: string;
  amount?: number;
  reasonCode: string;
  reasonNote?: string;
}): Promise<{ ok: true } | { error: string }> {
  if (!input.orderId) return { error: "Missing sale." };
  if (input.kind !== "void") return { error: "Unsupported request." };
  if (!input.reasonCode) return { error: "Choose a reason." };

  const { business } = await requireBusiness();
  const supabase = await createClient();
  const active = await getActiveStaff();

  // Don't stack duplicate pending requests for the same order+kind.
  const { data: dup } = await supabase
    .from("approval_requests")
    .select("id")
    .eq("business_id", business.id)
    .eq("order_id", input.orderId)
    .eq("kind", input.kind)
    .eq("status", "pending")
    .maybeSingle();
  if (dup) return { ok: true };

  const { error } = await supabase.from("approval_requests").insert({
    business_id: business.id,
    kind: input.kind,
    order_id: input.orderId,
    amount: input.amount ?? null,
    reason_code: input.reasonCode,
    reason_note: input.reasonNote ? input.reasonNote.slice(0, 500) : null,
    requested_by: active ? active.id : null,
    requested_by_name: active ? active.name : null,
    status: "pending",
  });
  if (error) {
    console.error("requestApproval:", error);
    return { error: "Could not send the request." };
  }

  await notifyBusiness(business.id, "exception", {
    title: "Approval needed",
    body:
      (input.kind === "void" ? "Void" : input.kind) +
      (input.amount ? " $" + Number(input.amount).toFixed(2) : "") +
      (active ? " — " + active.name : ""),
    url: "/app/approvals",
  });
  revalidatePath("/app/approvals");
  return { ok: true };
}

// Register variant: a mid-sale action (void/comp/discount) with no saved order
// yet. There's nothing for the server to execute on approval — the cashier's
// device applies the action once approved — so this records the request +
// notifies managers, and the register polls `getApprovalStatus`. The context
// label (table / cart) rides in payload so the manager knows what they're OK'ing.
export async function requestRegisterApproval(input: {
  kind: string;
  amount?: number;
  reasonCode?: string;
  reasonNote?: string;
  context?: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  if (!input.kind) return { error: "Missing action." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const active = await getActiveStaff();

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      business_id: business.id,
      kind: input.kind,
      order_id: null,
      amount: input.amount ?? null,
      reason_code: input.reasonCode ?? null,
      reason_note: input.reasonNote ? input.reasonNote.slice(0, 500) : null,
      requested_by: active ? active.id : null,
      requested_by_name: active ? active.name : null,
      status: "pending",
      payload: { source: "register", context: input.context ?? null },
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("requestRegisterApproval:", error);
    return { error: "Could not send the request." };
  }

  await notifyBusiness(business.id, "exception", {
    title: "Approval needed",
    body:
      input.kind.charAt(0).toUpperCase() + input.kind.slice(1) +
      (input.amount ? " $" + Number(input.amount).toFixed(2) : "") +
      (input.context ? " — " + input.context : "") +
      (active ? " — " + active.name : ""),
    url: "/app/approvals",
  });
  revalidatePath("/app/approvals");
  return { ok: true, id: data.id as string };
}

// Polled by the register while it waits on a sent approval.
export async function getApprovalStatus(
  id: string
): Promise<{ status: "pending" | "approved" | "denied" } | { error: string }> {
  if (!id) return { error: "Missing request." };
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("status")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!data) return { error: "Request not found." };
  const s = data.status as string;
  if (s === "approved" || s === "denied") return { status: s };
  return { status: "pending" };
}

export async function listPendingApprovals(): Promise<ApprovalRow[]> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("id, kind, order_id, amount, reason_code, reason_note, requested_by_name, payload, created_at")
    .eq("business_id", business.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  const rows = data ?? [];
  const orderIds = Array.from(new Set(rows.map((r) => r.order_id as string | null).filter((x): x is string => !!x)));
  const saleNo: Record<string, number | null> = {};
  if (orderIds.length > 0) {
    const { data: ords } = await supabase
      .from("orders")
      .select("id, sale_number")
      .eq("business_id", business.id)
      .in("id", orderIds);
    for (const o of ords ?? []) saleNo[o.id as string] = o.sale_number != null ? Number(o.sale_number) : null;
  }

  return rows.map((r) => ({
    id: r.id as string,
    kind: (r.kind as string) || "",
    orderId: (r.order_id as string | null) ?? null,
    saleNumber: r.order_id ? saleNo[r.order_id as string] ?? null : null,
    amount: r.amount != null ? Number(r.amount) : null,
    reasonCode: (r.reason_code as string | null) ?? null,
    reasonNote: (r.reason_note as string | null) ?? null,
    requestedByName: (r.requested_by_name as string | null) ?? null,
    context: ((r.payload as { context?: string | null } | null)?.context as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function decideApproval(
  id: string,
  approve: boolean
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing request." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can decide approvals." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: req } = await supabase
    .from("approval_requests")
    .select("id, kind, order_id, reason_code, reason_note, requested_by, requested_by_name, status, payload")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!req) return { error: "Request not found." };
  if ((req.status as string) !== "pending") return { error: "Already decided." };

  // Shift swap: on approval, reassign the shift to the requested staff member.
  if (approve && (req.kind as string) === "shift_swap") {
    const p = (req.payload ?? {}) as { shift_id?: string; to_staff_id?: string; to_name?: string };
    if (p.shift_id && p.to_staff_id) {
      const { error: swErr } = await supabase
        .from("shifts")
        .update({ staff_id: p.to_staff_id, published: false })
        .eq("id", p.shift_id)
        .eq("business_id", business.id);
      if (swErr) {
        console.error("decideApproval swap:", swErr);
        return { error: "Could not reassign the shift." };
      }
      await supabase.from("audit_events").insert({
        business_id: business.id,
        actor_id: user ? user.id : null,
        actor_role: role,
        action: "shift_swap",
        reason_code: "approved_request",
        metadata: { shift_id: p.shift_id, to_staff_id: p.to_staff_id, to_name: p.to_name ?? null, approved_by: user ? user.id : null, via: "approval_queue" },
      });
      revalidatePath("/app/schedule");
    }
  }

  // On approval, execute the action (void only in v1).
  if (approve && (req.kind as string) === "void" && req.order_id) {
    const { data: ord } = await supabase
      .from("orders")
      .select("total, status")
      .eq("id", req.order_id as string)
      .eq("business_id", business.id)
      .maybeSingle();
    if (ord && (ord.status as string) !== "voided") {
      const { error: vErr } = await supabase
        .from("orders")
        .update({ status: "voided" })
        .eq("id", req.order_id as string)
        .eq("business_id", business.id);
      if (vErr) {
        console.error("decideApproval void:", vErr);
        return { error: "Could not void the sale." };
      }
      await supabase.from("audit_events").insert({
        business_id: business.id,
        actor_id: user ? user.id : null,
        actor_role: role,
        action: "void",
        order_id: req.order_id as string,
        reason_code: (req.reason_code as string | null) ?? "approved_request",
        reason_note: (req.reason_note as string | null) ?? null,
        metadata: {
          amount: ord.total != null ? Number(ord.total) : null,
          staff_id: (req.requested_by as string | null) ?? null,
          staff_name: (req.requested_by_name as string | null) ?? null,
          approved_by: user ? user.id : null,
          via: "approval_queue",
        },
      });
    }
  }

  const { error } = await supabase
    .from("approval_requests")
    .update({ status: approve ? "approved" : "denied", decided_by: user ? user.id : null, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", business.id)
    .eq("status", "pending");
  if (error) {
    console.error("decideApproval:", error);
    return { error: "Could not record the decision." };
  }

  revalidatePath("/app/approvals");
  revalidatePath("/app/pos/sales");
  return { ok: true };
}
