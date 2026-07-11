"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { loadItemTaxMeta } from "@/lib/services/tax-meta";
import { computeSplitTotals } from "./split-alloc";
import { cookies } from "next/headers";
import { z } from "zod";
import { DISCOUNT_REASONS, COMP_REASONS, TAX_EXEMPT_REASONS, isValidReason } from "./reason-codes";

// Split check by item. The server is the money authority: it recomputes the
// whole-check totals (identical formulas to createOrder), then allocates every
// component (discount, comp, tax, service charge) across sub-checks with
// largest-remainder integer-cent rounding so the sub-checks sum to the original
// EXACTLY. Two settlement modes: 'separate' creates one paid order per
// sub-check; 'informational' creates a single order with a per-person breakdown
// recorded on the snapshot.

const splitItemSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
  taxable: z.coerce.boolean().optional(),
});

const splitPaymentSchema = z.object({
  method: z.enum(["cash", "card", "other"]),
  amount: z.coerce.number().min(0).max(1000000),
});

const splitCheckSchema = z.object({
  lines: z.array(splitItemSchema),
  // Per-square multi-tender: one or more payments that must sum to the square's
  // total. A single-element array preserves the old single-method behavior.
  payments: z.array(splitPaymentSchema).min(1),
  tip: z.coerce.number().min(0).max(1000000).optional(),
});

const splitSchema = z.object({
  items: z.array(splitItemSchema).min(1),
  checks: z.array(splitCheckSchema).min(2).max(10),
  settlement: z.enum(["separate", "informational"]),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  discount_reason_code: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  comp_value: z.coerce.number().min(0).max(1000000).optional(),
  comp_reason_code: z.string().max(60).optional(),
  comp_reason_note: z.string().max(500).optional(),
  service_charge: z.coerce.boolean().optional(),
  service_charge_waive_reason_code: z.string().max(60).optional(),
  service_charge_waive_reason_note: z.string().max(500).optional(),
  tax_exempt: z.coerce.boolean().optional(),
  tax_exempt_reason_code: z.string().max(60).optional(),
  tax_exempt_reason_note: z.string().max(500).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  dining_option: z.enum(["dine_in", "takeout", "delivery", "pickup"]).optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
  approver: z.object({ id: z.string().max(64), name: z.string().max(120) }).optional().nullable(),
});

type SplitInput = z.infer<typeof splitSchema>;
type SplitItem = z.infer<typeof splitItemSchema>;

const c = (dollars: number) => Math.round(dollars * 100);

export type SplitResultOrder = {
  id: string;
  sale_number: number;
  label: string;
  subtotal: number;
  discount: number;
  comp: number;
  tax: number;
  service_charge: number;
  tip: number;
  total: number;
  payment_method: string;
  items: { name: string; unit_price: number; quantity: number }[];
};

export async function finalizeSplitCheck(
  input: SplitInput
): Promise<{ ok: true; mode: "separate" | "informational"; orders: SplitResultOrder[] } | { error: string }> {
  const parsed = splitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid split." };
  }
  const data = parsed.data;

  const { business, role } = await requireBusiness();
  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  const supabase = await createClient();

  // Idempotency: if any order already carries this split group key, replay.
  const groupKey = data.idempotency_key ?? null;

  // --- customer + tax-exempt context ---
  let customerId: string | null = data.customer_id ?? null;
  let customerName: string | null = null;
  let customerExempt = false;
  let customerExemptNumber: string | null = null;
  if (customerId) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name, tax_exempt, tax_exempt_number")
      .eq("id", customerId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (cust) {
      customerName = (cust.name as string | null) ?? null;
      customerExempt = (cust.tax_exempt as boolean | null) === true;
      customerExemptNumber = (cust.tax_exempt_number as string | null) ?? null;
    } else {
      customerId = null;
    }
  }

  const { data: openSession } = await supabase
    .from("drawer_sessions")
    .select("id")
    .eq("business_id", business.id)
    .eq("status", "open")
    .maybeSingle();
  const drawerSessionId = openSession ? (openSession.id as string) : null;

  let activeStaffId: string | null = null;
  let activeStaffName: string | null = null;
  let activeStaffRole: string | null = null;
  {
    const cookieStore = await cookies();
    const sid = cookieStore.get("surge_active_staff")?.value || null;
    if (sid) {
      const { data: st } = await supabase
        .from("staff_members")
        .select("id, name, role, is_active")
        .eq("id", sid)
        .eq("business_id", business.id)
        .maybeSingle();
      if (st && st.is_active !== false) {
        activeStaffId = st.id as string;
        activeStaffName = st.name as string;
        activeStaffRole = st.role as string;
      }
    }
  }

  // Attribution guard (same rule as createOrder): a staffed business cannot
  // close a split under no cashier. No-staff businesses are exempt.
  if (!activeStaffId) {
    const { count: activeStaffCount } = await supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("is_active", true);
    if ((activeStaffCount ?? 0) > 0) {
      return { error: "A cashier must be signed in to close this sale." };
    }
  }

  // --- authoritative per-check totals (SHARED with quoteSplitCheck) ---
  let defaultRate = Number(business.default_tax_rate) || 0;
  if (defaultRate > 1) defaultRate = defaultRate / 100;
  const allItems = [...data.items, ...data.checks.flatMap((ck) => ck.lines)];
  const lineIds = Array.from(
    new Set(allItems.map((i) => i.catalog_item_id).filter((id): id is string => !!id))
  );
  const { itemTaxMeta, rateFracById, rateNameById } = await loadItemTaxMeta(supabase, business.id, lineIds);

  const scEnabled = (business as { service_charge_enabled?: boolean }).service_charge_enabled === true;
  let scPct = Number((business as { service_charge_pct?: number }).service_charge_pct) || 0;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scPostTax = (business as { service_charge_post_tax?: boolean }).service_charge_post_tax === true;
  const scLabel = ((business as { service_charge_label?: string }).service_charge_label || "Service charge").toString();

  const alloc = computeSplitTotals(data, { defaultRate, itemTaxMeta, rateFracById, rateNameById, customerExempt, scEnabled, scPct, scPostTax });
  if ("error" in alloc) return { error: alloc.error };
  const {
    subtotalCents, discountCents, compCents, taxTotalCents, scCents,
    checkSubtotalCents, discAlloc, compAlloc, taxAlloc, scAlloc, perCheckPreTipTotal,
    discount, comp, tax, serviceCharge, netSubtotal, isExempt, scApplied,
  } = alloc;
  const N = data.checks.length;

  // Reason gates (block the sale; kept out of the pure math).
  const discountReasonCode = (data.discount_reason_code || "").trim();
  const discountReasonNote = (data.discount_reason_note || "").trim();
  if (discount > 0) {
    if (!isValidReason(DISCOUNT_REASONS, discountReasonCode)) return { error: "Choose a reason for the discount." };
    if (discountReasonCode === "other" && !discountReasonNote) return { error: "Add a note explaining the discount." };
  }
  const compReasonCode = (data.comp_reason_code || "").trim();
  const compReasonNote = (data.comp_reason_note || "").trim();
  if (comp > 0) {
    if (!isValidReason(COMP_REASONS, compReasonCode)) return { error: "Choose a reason for the comp." };
    if (compReasonCode === "other" && !compReasonNote) return { error: "Add a note explaining the comp." };
  }
  const manualExempt = data.tax_exempt === true;
  const exemptCode = (data.tax_exempt_reason_code || "").trim();
  const exemptNote = (data.tax_exempt_reason_note || "").trim();
  if (manualExempt) {
    if (!isValidReason(TAX_EXEMPT_REASONS, exemptCode)) return { error: "Choose a reason for the tax exemption." };
    if (exemptCode === "other" && !exemptNote) return { error: "Add a note explaining the tax exemption." };
  }

  // Per-square payment integrity: each check's payments must sum to its total
  // (its pre-tip allocation + its own tip), to the cent. This is the multi-tender guard.
  for (let ci = 0; ci < N; ci++) {
    const tipC = c(data.checks[ci].tip ?? 0);
    const dueC = perCheckPreTipTotal[ci] + tipC;
    const paidC = data.checks[ci].payments.reduce((s, p) => s + c(p.amount), 0);
    if (paidC !== dueC) {
      return { error: "Seat " + (ci + 1) + "'s payments ($" + (paidC / 100).toFixed(2) + ") must equal its total ($" + (dueC / 100).toFixed(2) + ")." };
    }
  }

  // Whole-check sensitive-action audit (P0): attach to the single informational
  // order / the first separate sub-check — with the manager approver when one authorized.
  const splitApprover = data.approver ?? null;
  const splitApproverMeta = {
    approved_by: splitApprover ? splitApprover.id : null,
    approver_name: splitApprover ? splitApprover.name : null,
  };
  const {
    data: { user: splitUser },
  } = await supabase.auth.getUser();
  const splitActorId = splitUser ? splitUser.id : null;
  const splitAudit: {
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    reason_code: string | null;
    reason_note: string | null;
    metadata: Record<string, unknown>;
  }[] = [];
  if (!isTraining) {
    if (discount > 0) splitAudit.push({ actor_id: splitActorId, actor_role: role, action: "discount", reason_code: discountReasonCode || null, reason_note: discountReasonNote || null, metadata: { amount: discount, staff_id: activeStaffId, staff_name: activeStaffName, ...splitApproverMeta } });
    if (comp > 0) splitAudit.push({ actor_id: splitActorId, actor_role: role, action: "comp", reason_code: compReasonCode || null, reason_note: compReasonNote || null, metadata: { amount: comp, staff_id: activeStaffId, staff_name: activeStaffName, ...splitApproverMeta } });
    if (manualExempt) splitAudit.push({ actor_id: splitActorId, actor_role: role, action: "tax_exempt", reason_code: exemptCode || null, reason_note: exemptNote || null, metadata: { staff_id: activeStaffId, staff_name: activeStaffName, ...splitApproverMeta } });
  }

  // --- build per-check payloads ---
  const orders: SplitResultOrder[] = [];

  function snapBase(part: number) {
    return {
      split: {
        group: groupKey,
        mode: data.settlement,
        part: part + 1,
        count: N,
      },
    };
  }

  const wholeTip = data.checks.reduce((s, ck) => s + (ck.tip ?? 0), 0);

  // A square/check's tender label = the single method, or "split" for multi-tender.
  const methodOf = (payments: { method: string; amount: number }[]): string => {
    const methods = Array.from(new Set(payments.map((p) => p.method)));
    return methods.length === 1 ? methods[0] : "split";
  };
  const toPaymentRows = (payments: { method: string; amount: number }[]) =>
    payments.map((p) => ({ method: p.method, amount: Math.round(p.amount * 100) / 100, tendered: null, change_given: null, tender_type: p.method, finix_transfer_id: null, finix_state: null }));

  if (data.settlement === "informational") {
    // One order for the whole check; breakdown recorded on the snapshot.
    const tip = Math.round(wholeTip * 100) / 100;
    const total = Math.round((netSubtotal + tax + serviceCharge + tip) * 100) / 100;
    const parts = data.checks.map((ck, ci) => ({
      label: "Seat " + (ci + 1),
      subtotal: checkSubtotalCents[ci] / 100,
      discount: discAlloc[ci] / 100,
      comp: compAlloc[ci] / 100,
      tax: taxAlloc[ci] / 100,
      service_charge: scAlloc[ci] / 100,
      total: (checkSubtotalCents[ci] - discAlloc[ci] - compAlloc[ci] + taxAlloc[ci] + scAlloc[ci]) / 100,
      items: ck.lines.map((l) => ({ name: l.name, unit_price: l.unit_price, quantity: l.quantity })),
    }));
    // Whole-check tender = every square's payments flattened (multi-tender aware).
    const infoPayments = data.checks.flatMap((ck) => ck.payments);
    const payload = {
      business_id: business.id,
      status: "paid",
      subtotal: subtotalCents / 100,
      tax: tax,
      tip: tip,
      discount: discount,
      comp: comp,
      service_charge: serviceCharge,
      total: total,
      payment_method: methodOf(infoPayments),
      customer_id: customerId,
      drawer_session_id: drawerSessionId,
      is_training: isTraining,
      staff_id: activeStaffId,
      tax_exempt: isExempt,
      idempotency_key: groupKey,
      snapshot: {
        dining_option: data.dining_option ?? null,
        items: data.items.map((i) => ({ name: i.name, unit_price: i.unit_price, quantity: i.quantity })),
        subtotal: subtotalCents / 100,
        discount: { amount: discount, reason_code: discount > 0 ? discountReasonCode : null, reason_note: discount > 0 && discountReasonNote ? discountReasonNote : null },
        comp: { amount: comp, reason_code: comp > 0 ? compReasonCode : null, reason_note: comp > 0 && compReasonNote ? compReasonNote : null },
        tax: { amount: tax, exempt: isExempt },
        service_charge: { applied: scApplied, label: scLabel, pct: scPct, post_tax: scPostTax, amount: serviceCharge },
        tip: tip,
        total: total,
        customer: customerId ? { id: customerId, name: customerName } : null,
        staff: activeStaffId ? { id: activeStaffId, name: activeStaffName, role: activeStaffRole } : null,
        is_training: isTraining,
        split_breakdown: { mode: "informational", count: N, parts: parts },
        completed_at: new Date().toISOString(),
      },
      items: data.items.map((i) => ({ catalog_item_id: i.catalog_item_id ?? null, name: i.name, unit_price: i.unit_price, quantity: i.quantity })),
      payments: toPaymentRows(infoPayments),
      audit_events: splitAudit,
    };
    const { data: rpcData, error: rpcError } = await supabase.rpc("create_pos_order", { payload });
    if (rpcError || !rpcData) {
      return { error: splitRpcMessage(rpcError) };
    }
    const row = rpcData as { order_id: string; sale_number: number };
    orders.push({
      id: row.order_id,
      sale_number: Number(row.sale_number),
      label: "Whole check",
      subtotal: subtotalCents / 100,
      discount,
      comp,
      tax,
      service_charge: serviceCharge,
      tip: tip,
      total,
      payment_method: methodOf(infoPayments),
      items: data.items.map((i) => ({ name: i.name, unit_price: i.unit_price, quantity: i.quantity })),
    });
    return { ok: true, mode: "informational", orders };
  }

  // --- separate: one paid order per sub-check ---
  for (let ci = 0; ci < N; ci++) {
    const ck = data.checks[ci];
    const subCents = checkSubtotalCents[ci];
    const dCents = discAlloc[ci];
    const cmpCents = compAlloc[ci];
    const txCents = taxAlloc[ci];
    const scc = scAlloc[ci];
    const tip = Math.round((ck.tip ?? 0) * 100) / 100;
    const tipCents = c(tip);
    const totalCents = subCents - dCents - cmpCents + txCents + scc + tipCents;
    const total = totalCents / 100;
    const pm = methodOf(ck.payments);
    const label = "Seat " + (ci + 1) + " of " + N;

    const payload = {
      business_id: business.id,
      status: "paid",
      subtotal: subCents / 100,
      tax: txCents / 100,
      tip: tip,
      discount: dCents / 100,
      comp: cmpCents / 100,
      service_charge: scc / 100,
      total: total,
      payment_method: pm,
      customer_id: customerId,
      drawer_session_id: drawerSessionId,
      is_training: isTraining,
      staff_id: activeStaffId,
      tax_exempt: isExempt,
      idempotency_key: groupKey ? groupKey + "-" + (ci + 1) : undefined,
      snapshot: {
        dining_option: data.dining_option ?? null,
        items: ck.lines.map((l) => ({ name: l.name, unit_price: l.unit_price, quantity: l.quantity })),
        subtotal: subCents / 100,
        discount: { amount: dCents / 100 },
        comp: { amount: cmpCents / 100 },
        tax: { amount: txCents / 100, exempt: isExempt },
        service_charge: { applied: scApplied && scc > 0, label: scLabel, pct: scPct, post_tax: scPostTax, amount: scc / 100 },
        tip: tip,
        total: total,
        payment_method: pm,
        customer: customerId ? { id: customerId, name: customerName } : null,
        staff: activeStaffId ? { id: activeStaffId, name: activeStaffName, role: activeStaffRole } : null,
        is_training: isTraining,
        ...snapBase(ci),
        completed_at: new Date().toISOString(),
      },
      items: ck.lines.map((l) => ({ catalog_item_id: l.catalog_item_id ?? null, name: l.name, unit_price: l.unit_price, quantity: l.quantity })),
      payments: toPaymentRows(ck.payments),
      // Whole-check audit attaches to the first sub-check only (not per child).
      audit_events: ci === 0 ? splitAudit : [],
    };

    const { data: rpcData, error: rpcError } = await supabase.rpc("create_pos_order", { payload });
    if (rpcError || !rpcData) {
      return { error: splitRpcMessage(rpcError) + (orders.length ? " (" + orders.length + " sub-check(s) were already recorded)" : "") };
    }
    const row = rpcData as { order_id: string; sale_number: number };
    orders.push({
      id: row.order_id,
      sale_number: Number(row.sale_number),
      label,
      subtotal: subCents / 100,
      discount: dCents / 100,
      comp: cmpCents / 100,
      tax: txCents / 100,
      service_charge: scc / 100,
      tip: tip,
      total,
      payment_method: pm,
      items: ck.lines.map((l) => ({ name: l.name, unit_price: l.unit_price, quantity: l.quantity })),
    });
  }

  return { ok: true, mode: "separate", orders };
}

function splitRpcMessage(rpcError: { message?: string } | null): string {
  const msg = rpcError && rpcError.message ? rpcError.message : "";
  if (msg.indexOf("insufficient_stock:") !== -1) {
    const itemName = (msg.split("insufficient_stock:")[1] || "an item").trim();
    return "Out of stock: " + itemName + ".";
  }
  if (msg.indexOf("not_authorized") !== -1) return "You don't have access to record this sale.";
  return "Could not record the split. Please try again.";
}

// ---- Quote: authoritative per-square totals for the settlement UI --------------
// Same allocation math as finalizeSplitCheck (via computeSplitTotals), but computes
// no writes — the client shows Total/Paid/Outstanding squares against these totals,
// so the on-screen figures ALWAYS match what finalize will validate + record.
const quoteCheckSchema = z.object({
  lines: z.array(splitItemSchema),
  tip: z.coerce.number().min(0).max(1000000).optional(),
});
const quoteSchema = z.object({
  items: z.array(splitItemSchema).min(1),
  checks: z.array(quoteCheckSchema).min(2).max(10),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  comp_value: z.coerce.number().min(0).max(1000000).optional(),
  service_charge: z.coerce.boolean().optional(),
  tax_exempt: z.coerce.boolean().optional(),
  customer_id: z.string().uuid().optional().nullable(),
});

export type SplitQuoteCheck = { subtotal: number; discount: number; comp: number; tax: number; service_charge: number; tip: number; total: number };
export type SplitQuote = { ok: true; checks: SplitQuoteCheck[]; grandTotal: number };

export async function quoteSplitCheck(input: unknown): Promise<SplitQuote | { error: string }> {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid split." };
  const data = parsed.data;

  const { business } = await requireBusiness();
  const supabase = await createClient();

  let customerExempt = false;
  if (data.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("tax_exempt")
      .eq("id", data.customer_id)
      .eq("business_id", business.id)
      .maybeSingle();
    customerExempt = (cust?.tax_exempt as boolean | null) === true;
  }

  let defaultRate = Number(business.default_tax_rate) || 0;
  if (defaultRate > 1) defaultRate = defaultRate / 100;
  const lineIds = Array.from(
    new Set([...data.items, ...data.checks.flatMap((ck) => ck.lines)].map((i) => i.catalog_item_id).filter((id): id is string => !!id))
  );
  const { itemTaxMeta, rateFracById, rateNameById } = await loadItemTaxMeta(supabase, business.id, lineIds);
  const scEnabled = (business as { service_charge_enabled?: boolean }).service_charge_enabled === true;
  let scPct = Number((business as { service_charge_pct?: number }).service_charge_pct) || 0;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scPostTax = (business as { service_charge_post_tax?: boolean }).service_charge_post_tax === true;

  const alloc = computeSplitTotals(data, { defaultRate, itemTaxMeta, rateFracById, rateNameById, customerExempt, scEnabled, scPct, scPostTax });
  if ("error" in alloc) return { error: alloc.error };

  const checks: SplitQuoteCheck[] = data.checks.map((ck, ci) => {
    const tip = Math.round((ck.tip ?? 0) * 100) / 100;
    return {
      subtotal: alloc.checkSubtotalCents[ci] / 100,
      discount: alloc.discAlloc[ci] / 100,
      comp: alloc.compAlloc[ci] / 100,
      tax: alloc.taxAlloc[ci] / 100,
      service_charge: alloc.scAlloc[ci] / 100,
      tip,
      total: Math.round((alloc.perCheckPreTipTotal[ci] + Math.round(tip * 100))) / 100,
    };
  });
  const grandTotal = Math.round(checks.reduce((s, c) => s + c.total, 0) * 100) / 100;
  return { ok: true, checks, grandTotal };
}
