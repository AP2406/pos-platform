"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { isOrderPeriodLocked } from "@/lib/services/period-lock";
import { approverByPin } from "@/lib/services/permissions-server";
import { posAuthorize } from "@/lib/services/pos-action-guard";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { readActiveStaffId, ACTIVE_STAFF_COOKIE } from "@/lib/services/active-staff-cookie";

// P0-8: reopen a settled check and apply append-only adjustments. The original
// orders row + snapshot are never touched (a DB trigger enforces it); every
// correction is a new order_adjustments row. Reporting nets the chain.

const REOPEN_REASONS = ["correct_error", "add_items", "adjust_tip", "comp_after", "manager", "other"];
const ADJ_KINDS = ["reopen", "add_item", "tip_adjust", "comp", "void", "charge"];
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

async function getActiveStaffRow(supabase: Awaited<ReturnType<typeof createClient>>, businessId: string) {
  const cookieStore = await cookies();
  const sid = readActiveStaffId(cookieStore.get(ACTIVE_STAFF_COOKIE)?.value, businessId);
  if (!sid) return null;
  const { data } = await supabase
    .from("staff_members").select("id, name, role, is_active")
    .eq("id", sid).eq("business_id", businessId).maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
}

// Resolve actor + require approval unless the active operator holds
// `reopen_closed_check` (behavior-preserving: server/host need a manager PIN).
async function approve(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  memberRole: string,
  approverPin: string | undefined
): Promise<{ active: { id: string; name: string; role: string } | null; approver: { id: string; name: string } | null } | { needsApproval: true } | { error: string }> {
  // Previously `if (active && !actorCan(...))`, which skipped the check when no
  // cashier was signed in. Both callers happen to gate on owner/manager first,
  // so this was not reachable — but it will be once those checks move to the
  // matrix, so resolve the actor properly rather than leaving the shape behind.
  const auth = await posAuthorize(supabase, businessId, memberRole, "reopen_closed_check");
  if (!auth.ok) return { error: auth.error };
  const active = await getActiveStaffRow(supabase, businessId);
  if (auth.needsApproval) {
    if (!approverPin) return { needsApproval: true };
    const approver = await approverByPin(supabase, businessId, approverPin, "reopen_closed_check");
    if (!approver) return { error: "That PIN can't approve this." };
    return { active, approver };
  }
  return { active, approver: null };
}

export type AdjustmentRow = { id: string; kind: string; amount: number; reason_code: string; reason_note: string | null; created_at: string };

export async function getOrderAdjustments(orderId: string): Promise<AdjustmentRow[]> {
  if (!orderId) return [];
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_adjustments")
    .select("id, kind, amount, reason_code, reason_note, created_at")
    .eq("business_id", business.id)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    amount: Number(r.amount) || 0,
    reason_code: r.reason_code as string,
    reason_note: (r.reason_note as string | null) ?? null,
    created_at: r.created_at as string,
  }));
}

export async function reopenOrder(input: {
  order_id: string;
  reason_code: string;
  reason_note?: string;
  approver_pin?: string;
}): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  if (!input.order_id) return { error: "Missing sale." };
  if (!REOPEN_REASONS.includes(input.reason_code)) return { error: "Choose a reason." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can reopen a sale." };
  const supabase = await createClient();

  const gate = await approve(supabase, business.id, role, input.approver_pin);
  if ("needsApproval" in gate) return { needs_approval: true };
  if ("error" in gate) {
    // log the failed attempt
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_events").insert({
      business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
      action: "reopen_denied", order_id: input.order_id, reason_code: input.reason_code, reason_note: null,
      metadata: { error: "bad_pin" },
    });
    return gate;
  }

  const { data: order } = await supabase
    .from("orders").select("id, status, created_at").eq("id", input.order_id).eq("business_id", business.id).maybeSingle();
  if (!order) return { error: "Sale not found." };
  if (order.status === "voided") return { error: "This sale was voided." };
  {
    const tz = (business as { timezone?: string }).timezone || "America/Toronto";
    if (await isOrderPeriodLocked(supabase, business.id, order.created_at as string, tz)) {
      return { error: "That period is locked — this sale can't be reopened." };
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { error: adjErr } = await supabase.from("order_adjustments").insert({
    business_id: business.id, order_id: input.order_id, kind: "reopen", amount: 0,
    reason_code: input.reason_code, reason_note: input.reason_note?.trim().slice(0, 500) || null,
    snapshot: { reopened_at: new Date().toISOString(), staff: gate.active, approver: gate.approver },
    created_by: user ? user.id : null, approved_by: gate.approver ? gate.approver.id : null,
  });
  if (adjErr) { console.error("reopenOrder:", adjErr); return { error: "Could not reopen the sale." }; }

  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "reopen", order_id: input.order_id, reason_code: input.reason_code,
    reason_note: input.reason_note?.trim().slice(0, 500) || null,
    metadata: { staff_id: gate.active?.id ?? null, approved_by: gate.approver?.id ?? null },
  });

  revalidatePath("/app/pos/sales");
  return { ok: true };
}

export async function addOrderAdjustment(input: {
  order_id: string;
  kind: string;
  amount: number;
  reason_code: string;
  reason_note?: string;
  approver_pin?: string;
}): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  if (!input.order_id) return { error: "Missing sale." };
  if (!ADJ_KINDS.includes(input.kind) || input.kind === "reopen") return { error: "Invalid adjustment." };
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount === 0) return { error: "Enter an amount." };
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") return { error: "Only an owner or manager can adjust a sale." };
  const supabase = await createClient();

  const gate = await approve(supabase, business.id, role, input.approver_pin);
  if ("needsApproval" in gate) return { needs_approval: true };
  if ("error" in gate) return gate;

  const { data: order } = await supabase
    .from("orders").select("id, status, created_at").eq("id", input.order_id).eq("business_id", business.id).maybeSingle();
  if (!order) return { error: "Sale not found." };
  {
    const tz = (business as { timezone?: string }).timezone || "America/Toronto";
    if (await isOrderPeriodLocked(supabase, business.id, order.created_at as string, tz)) {
      return { error: "That period is locked — this sale can't be adjusted." };
    }
  }

  // Sign convention: comp / void reduce the take; add_item / charge / tip add to it.
  const signed = input.kind === "comp" || input.kind === "void" ? -Math.abs(amount) : Math.abs(amount);

  const { data: openDrawer } = await supabase
    .from("drawer_sessions").select("id").eq("business_id", business.id).eq("status", "open").maybeSingle();
  const { data: { user } } = await supabase.auth.getUser();

  const { error: adjErr } = await supabase.from("order_adjustments").insert({
    business_id: business.id, order_id: input.order_id, kind: input.kind, amount: signed,
    reason_code: input.reason_code || input.kind, reason_note: input.reason_note?.trim().slice(0, 500) || null,
    snapshot: { applied_at: new Date().toISOString(), staff: gate.active, approver: gate.approver },
    drawer_session_id: openDrawer ? (openDrawer.id as string) : null,
    created_by: user ? user.id : null, approved_by: gate.approver ? gate.approver.id : null,
  });
  if (adjErr) { console.error("addOrderAdjustment:", adjErr); return { error: "Could not record the adjustment." }; }

  await supabase.from("audit_events").insert({
    business_id: business.id, actor_id: user ? user.id : null, actor_role: role,
    action: "order_adjustment", order_id: input.order_id, reason_code: input.reason_code || input.kind,
    reason_note: input.reason_note?.trim().slice(0, 500) || null,
    metadata: { kind: input.kind, amount: signed, staff_id: gate.active?.id ?? null, approved_by: gate.approver?.id ?? null },
  });

  revalidatePath("/app/pos/sales");
  return { ok: true };
}
