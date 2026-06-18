"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { cookies } from "next/headers";
import { z } from "zod";
import { DISCOUNT_REASONS, COMP_REASONS, TAX_EXEMPT_REASONS, isValidReason } from "./reason-codes";
import { allocateWeighted } from "./split-math";

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

const splitCheckSchema = z.object({
  lines: z.array(splitItemSchema),
  payment_method: z.enum(["cash", "card", "other"]).optional(),
  tip: z.coerce.number().min(0).max(1000000).optional(),
});

const splitSchema = z.object({
  items: z.array(splitItemSchema).min(1),
  checks: z.array(splitCheckSchema).min(2).max(8),
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

  // --- resolve per-item tax fractions (same as createOrder) ---
  let defaultRate = Number(business.default_tax_rate) || 0;
  if (defaultRate > 1) defaultRate = defaultRate / 100;

  const allItems = [...data.items, ...data.checks.flatMap((ck) => ck.lines)];
  const lineIds = Array.from(
    new Set(allItems.map((i) => i.catalog_item_id).filter((id): id is string => !!id))
  );
  const itemTaxMeta: Record<string, { taxable: boolean; tax_rate_id: string | null }> = {};
  if (lineIds.length > 0) {
    const { data: taxRows } = await supabase
      .from("catalog_items")
      .select("id, taxable, tax_rate_id")
      .eq("business_id", business.id)
      .in("id", lineIds);
    for (const r of taxRows ?? []) {
      itemTaxMeta[r.id as string] = {
        taxable: (r.taxable as boolean | null) ?? true,
        tax_rate_id: (r.tax_rate_id as string | null) ?? null,
      };
    }
  }
  const usedRateIds = Array.from(
    new Set(Object.values(itemTaxMeta).map((m) => m.tax_rate_id).filter((id): id is string => !!id))
  );
  const rateFracById: Record<string, number> = {};
  const rateNameById: Record<string, string> = {};
  if (usedRateIds.length > 0) {
    const { data: rateRows } = await supabase
      .from("tax_rates")
      .select("id, name, rate")
      .eq("business_id", business.id)
      .in("id", usedRateIds);
    for (const r of rateRows ?? []) {
      rateFracById[r.id as string] = (Number(r.rate) || 0) / 100;
      rateNameById[r.id as string] = r.name as string;
    }
  }

  // Bucket identity (label@frac) for a line, mirroring createOrder.
  function bucketOf(it: SplitItem): { taxable: boolean; key: string; label: string; frac: number } {
    const meta = it.catalog_item_id ? itemTaxMeta[it.catalog_item_id] : undefined;
    const isTaxable = meta ? meta.taxable : it.taxable !== false;
    let frac = defaultRate;
    let label = "Tax";
    if (meta && meta.tax_rate_id && rateFracById[meta.tax_rate_id] !== undefined) {
      frac = rateFracById[meta.tax_rate_id];
      label = rateNameById[meta.tax_rate_id] || "Tax";
    }
    if (!isTaxable || frac <= 0) return { taxable: false, key: "", label: "", frac: 0 };
    return { taxable: true, key: label + "@" + frac.toFixed(6), label, frac };
  }

  // --- whole-check authoritative totals (identical math to createOrder) ---
  const subtotal = data.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const subtotalCents = c(subtotal);
  if (subtotalCents <= 0) return { error: "Nothing to split." };

  const discountType = data.discount_type ?? "amount";
  const discountValue = data.discount_value ?? 0;
  let discount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;
  const discountReasonCode = (data.discount_reason_code || "").trim();
  const discountReasonNote = (data.discount_reason_note || "").trim();
  if (discount > 0) {
    if (!isValidReason(DISCOUNT_REASONS, discountReasonCode)) return { error: "Choose a reason for the discount." };
    if (discountReasonCode === "other" && !discountReasonNote) return { error: "Add a note explaining the discount." };
  }

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  let comp = data.comp_value ?? 0;
  if (comp < 0) comp = 0;
  if (comp > discountedSubtotal) comp = discountedSubtotal;
  comp = Math.round(comp * 100) / 100;
  const compReasonCode = (data.comp_reason_code || "").trim();
  const compReasonNote = (data.comp_reason_note || "").trim();
  if (comp > 0) {
    if (!isValidReason(COMP_REASONS, compReasonCode)) return { error: "Choose a reason for the comp." };
    if (compReasonCode === "other" && !compReasonNote) return { error: "Add a note explaining the comp." };
  }
  const netSubtotal = Math.round((discountedSubtotal - comp) * 100) / 100;
  const taxF = subtotal > 0 ? netSubtotal / subtotal : 0;

  // whole-check tax buckets
  const wholeBuckets: Record<string, { label: string; frac: number; base: number }> = {};
  for (const it of data.items) {
    const b = bucketOf(it);
    if (!b.taxable) continue;
    if (!wholeBuckets[b.key]) wholeBuckets[b.key] = { label: b.label, frac: b.frac, base: 0 };
    wholeBuckets[b.key].base += it.unit_price * it.quantity;
  }
  const bucketTaxCents: Record<string, number> = {};
  let tax = 0;
  for (const key of Object.keys(wholeBuckets)) {
    const b = wholeBuckets[key];
    const discountedBase = Math.round(b.base * taxF * 100) / 100;
    const amt = Math.round(discountedBase * b.frac * 100) / 100;
    bucketTaxCents[key] = c(amt);
    tax += amt;
  }
  tax = Math.round(tax * 100) / 100;

  const manualExempt = data.tax_exempt === true;
  const exemptCode = (data.tax_exempt_reason_code || "").trim();
  const exemptNote = (data.tax_exempt_reason_note || "").trim();
  if (manualExempt) {
    if (!isValidReason(TAX_EXEMPT_REASONS, exemptCode)) return { error: "Choose a reason for the tax exemption." };
    if (exemptCode === "other" && !exemptNote) return { error: "Add a note explaining the tax exemption." };
  }
  const isExempt = manualExempt || customerExempt;
  if (isExempt) {
    for (const key of Object.keys(bucketTaxCents)) bucketTaxCents[key] = 0;
    tax = 0;
  }

  // service charge (authoritative, same as createOrder)
  const scEnabled = (business as { service_charge_enabled?: boolean }).service_charge_enabled === true;
  let scPct = Number((business as { service_charge_pct?: number }).service_charge_pct) || 0;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scPostTax = (business as { service_charge_post_tax?: boolean }).service_charge_post_tax === true;
  const scLabel = ((business as { service_charge_label?: string }).service_charge_label || "Service charge").toString();
  const scApplied = scEnabled && scPct > 0 && data.service_charge === true;
  const scBase = scApplied ? (scPostTax ? Math.round((netSubtotal + tax) * 100) / 100 : netSubtotal) : 0;
  const serviceCharge = scApplied ? Math.round(scBase * (scPct / 100) * 100) / 100 : 0;

  const discountCents = c(discount);
  const compCents = c(comp);
  const scCents = c(serviceCharge);

  // --- partition: per-check item subtotal + per-bucket base ---
  const N = data.checks.length;
  const checkSubtotalCents: number[] = [];
  const checkBucketBaseCents: Record<string, number[]> = {};
  for (const key of Object.keys(wholeBuckets)) checkBucketBaseCents[key] = new Array(N).fill(0);
  for (let ci = 0; ci < N; ci++) {
    let s = 0;
    for (const ln of data.checks[ci].lines) {
      s += c(ln.unit_price * ln.quantity);
      const b = bucketOf(ln);
      if (b.taxable && checkBucketBaseCents[b.key]) {
        checkBucketBaseCents[b.key][ci] += c(ln.unit_price * ln.quantity);
      }
    }
    checkSubtotalCents.push(s);
  }
  const partitionSum = checkSubtotalCents.reduce((a, b) => a + b, 0);
  if (partitionSum !== subtotalCents) {
    return { error: "Split doesn't add up to the check. Assign every item exactly once." };
  }
  for (let ci = 0; ci < N; ci++) {
    if (checkSubtotalCents[ci] <= 0) return { error: "Every sub-check needs at least one item." };
  }

  // --- allocate each component across checks (exact, largest-remainder) ---
  const discAlloc = allocateWeighted(discountCents, checkSubtotalCents);
  const compAlloc = allocateWeighted(compCents, checkSubtotalCents);
  const scAlloc = allocateWeighted(scCents, checkSubtotalCents);
  // tax allocated per rate bucket by each check's taxable base in that bucket
  const taxAlloc = new Array<number>(N).fill(0);
  let taxTotalCents = 0;
  for (const key of Object.keys(bucketTaxCents)) {
    taxTotalCents += bucketTaxCents[key];
    const shares = allocateWeighted(bucketTaxCents[key], checkBucketBaseCents[key]);
    for (let ci = 0; ci < N; ci++) taxAlloc[ci] += shares[ci];
  }

  // --- conservation invariant: parts must sum to the original, to the cent ---
  const grandTotalCents = subtotalCents - discountCents - compCents + taxTotalCents + scCents;
  const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const perCheckPreTipTotal = checkSubtotalCents.map(
    (s, ci) => s - discAlloc[ci] - compAlloc[ci] + taxAlloc[ci] + scAlloc[ci]
  );
  if (
    sumOf(checkSubtotalCents) !== subtotalCents ||
    sumOf(discAlloc) !== discountCents ||
    sumOf(compAlloc) !== compCents ||
    sumOf(taxAlloc) !== taxTotalCents ||
    sumOf(scAlloc) !== scCents ||
    sumOf(perCheckPreTipTotal) !== grandTotalCents
  ) {
    return { error: "Split failed to reconcile to the check total. No payment was taken." };
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
      payment_method: data.checks[0].payment_method ?? "cash",
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
      payments: [{ method: data.checks[0].payment_method ?? "cash", amount: total, tendered: null, change_given: null, tender_type: data.checks[0].payment_method ?? "cash", finix_transfer_id: null, finix_state: null }],
      audit_events: [],
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
      payment_method: data.checks[0].payment_method ?? "cash",
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
    const pm = ck.payment_method ?? "cash";
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
      payments: [{ method: pm, amount: total, tendered: null, change_given: null, tender_type: pm, finix_transfer_id: null, finix_state: null }],
      audit_events: [],
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
