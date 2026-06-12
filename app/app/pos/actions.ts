"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { VOID_REASONS, DISCOUNT_REASONS, TAX_EXEMPT_REASONS, COMP_REASONS, SERVICE_CHARGE_WAIVE_REASONS, isValidReason } from "./reason-codes";

const lineSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
  note: z.string().max(280).optional().nullable(),
  seat: z.coerce.number().int().min(1).max(99).optional().nullable(),
});

const DINING_OPTIONS = ["dine_in", "takeout", "delivery", "pickup"] as const;

const paymentLineSchema = z.object({
  method: z.enum(["cash", "card", "other"]),
  amount: z.coerce.number().min(0).max(1000000),
  tendered: z.coerce.number().min(0).max(1000000).optional().nullable(),
});

const voidLineSchema = z.object({
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
  reason_code: z.string().max(60).optional(),
  reason_note: z.string().max(500).optional(),
});

const orderSchema = z.object({
  items: z.array(lineSchema).min(1, "Add at least one item."),
  voids: z.array(voidLineSchema).optional(),
  tip: z.coerce.number().min(0).max(1000000).optional(),
  payment_method: z.enum(["cash", "card", "other"]).optional(),
  payments: z.array(paymentLineSchema).optional(),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  discount_reason_code: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  comp_value: z.coerce.number().min(0).max(1000000).optional(),
  comp_reason_code: z.string().max(60).optional(),
  comp_reason_note: z.string().max(500).optional(),
  service_charge: z.coerce.boolean().optional(),
  service_charge_auto: z.coerce.boolean().optional(),
  service_charge_waive_reason_code: z.string().max(60).optional(),
  service_charge_waive_reason_note: z.string().max(500).optional(),
  tax_exempt: z.coerce.boolean().optional(),
  tax_exempt_reason_code: z.string().max(60).optional(),
  tax_exempt_reason_note: z.string().max(500).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
  dining_option: z.enum(DINING_OPTIONS).optional().nullable(),
});

type PaymentInput = {
  method: "cash" | "card" | "other";
  amount: number;
  tendered?: number | null;
};

type OrderInput = {
  items: {
    catalog_item_id?: string | null;
    name: string;
    unit_price: number;
    quantity: number;
  }[];
  voids?: { name: string; unit_price: number; quantity: number; reason_code?: string; reason_note?: string }[];
  tip?: number;
  payment_method?: "cash" | "card" | "other";
  payments?: PaymentInput[];
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  comp_value?: number;
  comp_reason_code?: string;
  comp_reason_note?: string;
  service_charge?: boolean;
  service_charge_auto?: boolean;
  service_charge_waive_reason_code?: string;
  service_charge_waive_reason_note?: string;
  tax_exempt?: boolean;
  tax_exempt_reason_code?: string;
  tax_exempt_reason_note?: string;
  customer_id?: string | null;
  idempotency_key?: string;
  dining_option?: "dine_in" | "takeout" | "delivery" | "pickup" | null;
};

type Tender = {
  method: "cash" | "card" | "other";
  amount: number;
  tendered: number | null;
  change: number | null;
};

type CreateOrderResult =
  | { ok: true; id: string; sale_number: number }
  | { error: string };

async function getActiveStaffRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<{ id: string; name: string; role: string } | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get("surge_active_staff")?.value || null;
  if (!sid) return null;
  const { data } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", sid)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data || data.is_active === false) return null;
  return { id: data.id as string, name: data.name as string, role: data.role as string };
}

async function getManagerByPin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  pin: string | undefined
): Promise<{ id: string; name: string } | null> {
  if (!pin || !/^[0-9]{4,6}$/.test(pin)) return null;
  const { data } = await supabase.rpc("verify_staff_member_pin", {
    p_business_id: businessId,
    p_pin: pin,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.role !== "manager") return null;
  return { id: row.id as string, name: row.name as string };
}

export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { business, role } = await requireBusiness();
  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  const supabase = await createClient();

  const idemKey = parsed.data.idempotency_key ?? null;
  if (idemKey) {
    const { data: existing } = await supabase
      .from("orders")
      .select("id, sale_number")
      .eq("business_id", business.id)
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        id: existing.id as string,
        sale_number: Number(existing.sale_number),
      };
    }
  }

  let customerId: string | null = parsed.data.customer_id ?? null;
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

  const subtotal = parsed.data.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );

  // Voided items (not made): recorded for accountability but never charged or
  // inventoried. They don't touch the totals — only void_total + the snapshot.
  const voidLines = parsed.data.voids ?? [];
  const voidTotal = Math.round(voidLines.reduce((s, v) => s + v.unit_price * v.quantity, 0) * 100) / 100;

  const discountType = parsed.data.discount_type ?? "amount";
  const discountValue = parsed.data.discount_value ?? 0;
  let discount =
    discountType === "percent"
      ? subtotal * (discountValue / 100)
      : discountValue;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountReasonCode = (parsed.data.discount_reason_code || "").trim();
  const discountReasonNote = (parsed.data.discount_reason_note || "").trim();
  if (discount > 0) {
    if (!isValidReason(DISCOUNT_REASONS, discountReasonCode)) {
      return { error: "Choose a reason for the discount." };
    }
    if (discountReasonCode === "other" && !discountReasonNote) {
      return { error: "Add a note explaining the discount." };
    }
  }

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;

  // Comp (on-the-house): a pre-tax reduction applied after any discount,
  // recorded separately from discount. Capped to what's left after the discount.
  let comp = parsed.data.comp_value ?? 0;
  if (comp < 0) comp = 0;
  if (comp > discountedSubtotal) comp = discountedSubtotal;
  comp = Math.round(comp * 100) / 100;
  const compReasonCode = (parsed.data.comp_reason_code || "").trim();
  const compReasonNote = (parsed.data.comp_reason_note || "").trim();
  if (comp > 0) {
    if (!isValidReason(COMP_REASONS, compReasonCode)) {
      return { error: "Choose a reason for the comp." };
    }
    if (compReasonCode === "other" && !compReasonNote) {
      return { error: "Add a note explaining the comp." };
    }
  }
  const netSubtotal = Math.round((discountedSubtotal - comp) * 100) / 100;

  let rate = Number(business.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const taxLineIds = Array.from(
    new Set(
      parsed.data.items
        .map((i) => i.catalog_item_id)
        .filter((id): id is string => !!id)
    )
  );
  const itemTaxMeta: Record<string, { taxable: boolean; tax_rate_id: string | null }> = {};
  if (taxLineIds.length > 0) {
    const { data: taxRows } = await supabase
      .from("catalog_items")
      .select("id, taxable, tax_rate_id")
      .eq("business_id", business.id)
      .in("id", taxLineIds);
    for (const r of taxRows ?? []) {
      itemTaxMeta[r.id as string] = {
        taxable: (r.taxable as boolean | null) ?? true,
        tax_rate_id: (r.tax_rate_id as string | null) ?? null,
      };
    }
  }

  const usedRateIds = Array.from(
    new Set(
      Object.values(itemTaxMeta)
        .map((m) => m.tax_rate_id)
        .filter((id): id is string => !!id)
    )
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

  const taxF = subtotal > 0 ? netSubtotal / subtotal : 0;

  const rateBuckets: Record<string, { label: string; frac: number; base: number }> = {};
  for (const i of parsed.data.items) {
    const meta = i.catalog_item_id ? itemTaxMeta[i.catalog_item_id] : undefined;
    const isTaxable = meta ? meta.taxable : true;
    if (!isTaxable) continue;
    let frac = rate;
    let label = "Tax";
    if (meta && meta.tax_rate_id && rateFracById[meta.tax_rate_id] !== undefined) {
      frac = rateFracById[meta.tax_rate_id];
      label = rateNameById[meta.tax_rate_id] || "Tax";
    }
    if (frac <= 0) continue;
    const key = label + "@" + frac.toFixed(6);
    if (!rateBuckets[key]) rateBuckets[key] = { label: label, frac: frac, base: 0 };
    rateBuckets[key].base += i.unit_price * i.quantity;
  }

  let tax = 0;
  let taxableBase = 0;
  const taxBreakdown: { label: string; rate: number; base: number; amount: number }[] = [];
  for (const key of Object.keys(rateBuckets)) {
    const b = rateBuckets[key];
    const discountedBase = Math.round(b.base * taxF * 100) / 100;
    const amount = Math.round(discountedBase * b.frac * 100) / 100;
    tax += amount;
    taxableBase += discountedBase;
    taxBreakdown.push({ label: b.label, rate: b.frac, base: discountedBase, amount: amount });
  }
  tax = Math.round(tax * 100) / 100;
  taxableBase = Math.round(taxableBase * 100) / 100;

  const manualExempt = parsed.data.tax_exempt === true;
  const exemptCode = (parsed.data.tax_exempt_reason_code || "").trim();
  const exemptNote = (parsed.data.tax_exempt_reason_note || "").trim();
  if (manualExempt) {
    if (!isValidReason(TAX_EXEMPT_REASONS, exemptCode)) {
      return { error: "Choose a reason for the tax exemption." };
    }
    if (exemptCode === "other" && !exemptNote) {
      return { error: "Add a note explaining the tax exemption." };
    }
  }
  const isExempt = manualExempt || customerExempt;
  let taxExemptInfo:
    | { source: "manual" | "customer"; reason_code: string | null; reason_note: string | null; number: string | null }
    | null = null;
  if (isExempt) {
    if (manualExempt) {
      taxExemptInfo = { source: "manual", reason_code: exemptCode, reason_note: exemptNote || null, number: null };
    } else {
      taxExemptInfo = { source: "customer", reason_code: "customer", reason_note: null, number: customerExemptNumber };
    }
    for (const b of taxBreakdown) b.amount = 0;
    tax = 0;
  }

  // Service charge / auto-gratuity — the amount is recomputed here from the
  // business policy (the client only says whether it's applied). It is NOT
  // taxed; its base is the pre-tax net (default) or the post-tax amount.
  const scEnabled = (business as { service_charge_enabled?: boolean }).service_charge_enabled === true;
  let scPct = Number((business as { service_charge_pct?: number }).service_charge_pct) || 0;
  if (scPct < 0) scPct = 0;
  if (scPct > 100) scPct = 100;
  const scPostTax = (business as { service_charge_post_tax?: boolean }).service_charge_post_tax === true;
  const scLabel = ((business as { service_charge_label?: string }).service_charge_label || "Service charge").toString();
  const scApplied = scEnabled && scPct > 0 && parsed.data.service_charge === true;
  const scBase = scApplied ? (scPostTax ? Math.round((netSubtotal + tax) * 100) / 100 : netSubtotal) : 0;
  const scAmount = scApplied ? Math.round(scBase * (scPct / 100) * 100) / 100 : 0;

  // P0-10c: a mandatory large-party charge is an AUTO-GRATUITY — in Canada that
  // is a service charge that IS taxable (HST applies), and it's recorded apart
  // from a manual service charge and from a voluntary (non-taxable) tip. The
  // client flags which one was applied.
  const scIsAuto = scApplied && parsed.data.service_charge_auto === true;
  const autoGratuity = scIsAuto ? scAmount : 0;
  const serviceCharge = scIsAuto ? 0 : scAmount;
  const autoGratTax = scIsAuto && !isExempt ? Math.round(autoGratuity * rate * 100) / 100 : 0;
  if (autoGratTax > 0) {
    tax = Math.round((tax + autoGratTax) * 100) / 100;
    taxableBase = Math.round((taxableBase + autoGratuity) * 100) / 100;
  }

  // Waiving an enabled service charge is the sensitive, reason-coded action.
  const scWaiveCode = (parsed.data.service_charge_waive_reason_code || "").trim();
  const scWaiveNote = (parsed.data.service_charge_waive_reason_note || "").trim();
  const scWaived = scEnabled && scPct > 0 && !scApplied && scWaiveCode !== "";
  if (scWaived) {
    if (!isValidReason(SERVICE_CHARGE_WAIVE_REASONS, scWaiveCode)) {
      return { error: "Choose a reason for waiving the service charge." };
    }
    if (scWaiveCode === "other" && !scWaiveNote) {
      return { error: "Add a note explaining the waived service charge." };
    }
  }

  const tip = parsed.data.tip ?? 0;
  const total = Math.round((netSubtotal + tax + serviceCharge + autoGratuity + tip) * 100) / 100;
  const paymentMethod = parsed.data.payment_method ?? "cash";

  let tenders: Tender[] = [];
  const providedPayments = parsed.data.payments ?? [];
  if (providedPayments.length > 0) {
    const cleaned = providedPayments
      .map((p) => ({
        method: p.method,
        amount: Math.round((Number(p.amount) || 0) * 100) / 100,
        tendered:
          p.tendered === null || p.tendered === undefined
            ? null
            : Math.round((Number(p.tendered) || 0) * 100) / 100,
      }))
      .filter((p) => p.amount > 0);

    if (cleaned.length === 0) {
      return { error: "Enter at least one payment amount." };
    }

    const sumCents = cleaned.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    if (sumCents !== Math.round(total * 100)) {
      return {
        error: "Payments must add up to the sale total of " + total.toFixed(2) + ".",
      };
    }

    tenders = cleaned.map((p) => ({
      method: p.method,
      amount: p.amount,
      tendered: p.method === "cash" ? p.tendered : null,
      change:
        p.method === "cash" && p.tendered !== null
          ? Math.round((p.tendered - p.amount) * 100) / 100
          : null,
    }));
  } else {
    tenders = [{ method: paymentMethod, amount: total, tendered: null, change: null }];
  }

  const distinctMethods = Array.from(new Set(tenders.map((t) => t.method)));
  const orderPaymentMethod =
    distinctMethods.length > 1 ? "split" : distinctMethods[0];

  const snapshot = {
    dining_option: parsed.data.dining_option ?? null,
    items: parsed.data.items.map((i) => ({
      name: i.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      note: i.note ?? null,
      seat: i.seat ?? null,
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    discount: {
      type: discountType,
      value: discountValue,
      amount: discount,
      reason_code: discount > 0 ? discountReasonCode : null,
      reason_note: discount > 0 && discountReasonNote ? discountReasonNote : null,
    },
    comp: {
      amount: comp,
      reason_code: comp > 0 ? compReasonCode : null,
      reason_note: comp > 0 && compReasonNote ? compReasonNote : null,
    },
    voids: {
      total: voidTotal,
      lines: voidLines.map((v) => ({ name: v.name, unit_price: v.unit_price, quantity: v.quantity, reason_code: (v.reason_code || "").trim() || null, reason_note: (v.reason_note || "").trim() || null })),
    },
    tax: { rate: rate, amount: tax, taxable_base: taxableBase, breakdown: taxBreakdown, exempt: taxExemptInfo },
    service_charge: {
      applied: scApplied && !scIsAuto,
      label: scLabel,
      pct: scPct,
      post_tax: scPostTax,
      base: scBase,
      amount: serviceCharge,
      waived: scWaived,
      waive_reason_code: scWaived ? scWaiveCode : null,
      waive_reason_note: scWaived && scWaiveNote ? scWaiveNote : null,
    },
    auto_gratuity: {
      applied: scIsAuto,
      label: scLabel,
      pct: scPct,
      amount: autoGratuity,
      taxable: true,
      hst: autoGratTax,
    },
    tip: tip,
    total: total,
    payment_method: orderPaymentMethod,
    payments: tenders.map((t) => ({
      method: t.method,
      amount: t.amount,
      tendered: t.tendered,
      change: t.change,
    })),
    customer: customerId ? { id: customerId, name: customerName } : null,
    staff: activeStaffId ? { id: activeStaffId, name: activeStaffName, role: activeStaffRole } : null,
    is_training: isTraining,
    completed_at: new Date().toISOString(),
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user ? user.id : null;

  const auditEvents: {
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    reason_code: string | null;
    reason_note: string | null;
    metadata: Record<string, unknown>;
  }[] = [];
  if (discount > 0 && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "discount",
      reason_code: discountReasonCode,
      reason_note: discountReasonNote ? discountReasonNote.slice(0, 500) : null,
      metadata: { type: discountType, value: discountValue, amount: discount, staff_id: activeStaffId, staff_name: activeStaffName },
    });
  }
  if (comp > 0 && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "comp",
      reason_code: compReasonCode,
      reason_note: compReasonNote ? compReasonNote.slice(0, 500) : null,
      metadata: { amount: comp, staff_id: activeStaffId, staff_name: activeStaffName },
    });
  }
  for (const v of voidLines) {
    if (isTraining) break;
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "void",
      reason_code: (v.reason_code || "").trim() || null,
      reason_note: (v.reason_note || "").trim() ? (v.reason_note as string).trim().slice(0, 500) : null,
      metadata: { name: v.name, amount: Math.round(v.unit_price * v.quantity * 100) / 100, quantity: v.quantity, staff_id: activeStaffId, staff_name: activeStaffName },
    });
  }
  if (scWaived && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "service_charge_waived",
      reason_code: scWaiveCode,
      reason_note: scWaiveNote ? scWaiveNote.slice(0, 500) : null,
      metadata: { pct: scPct, staff_id: activeStaffId, staff_name: activeStaffName },
    });
  }
  if (manualExempt && !isTraining) {
    auditEvents.push({
      actor_id: authUserId,
      actor_role: role,
      action: "tax_exempt",
      reason_code: exemptCode,
      reason_note: exemptNote ? exemptNote.slice(0, 500) : null,
      metadata: { staff_id: activeStaffId, staff_name: activeStaffName, taxable_base: taxableBase },
    });
  }

  const itemsPayload = parsed.data.items.map((i) => ({
    catalog_item_id: i.catalog_item_id ?? null,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
  }));

  const paymentsPayload = tenders.map((t) => ({
    method: t.method,
    amount: t.amount,
    tendered: t.tendered,
    change_given: t.change,
    tender_type: t.method,
    finix_transfer_id: null,
    finix_state: null,
  }));

  const payload = {
    business_id: business.id,
    status: "paid",
    subtotal: Math.round(subtotal * 100) / 100,
    tax: tax,
    tip: tip,
    discount: discount,
    comp: comp,
    service_charge: serviceCharge,
    auto_gratuity: autoGratuity,
    void_total: voidTotal,
    total: total,
    payment_method: orderPaymentMethod,
    customer_id: customerId,
    drawer_session_id: drawerSessionId,
    is_training: isTraining,
    staff_id: activeStaffId,
    tax_exempt: isExempt,
    idempotency_key: idemKey,
    snapshot: snapshot,
    items: itemsPayload,
    payments: paymentsPayload,
    audit_events: auditEvents,
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_pos_order", {
    payload: payload,
  });

  if (rpcError || !rpcData) {
    const msg = rpcError && rpcError.message ? rpcError.message : "";
    if (msg.indexOf("insufficient_stock:") !== -1) {
      const itemName = (msg.split("insufficient_stock:")[1] || "an item").trim();
      return { error: "Out of stock: " + itemName + "." };
    }
    if (msg.indexOf("tender_short") !== -1) {
      return { error: "Payments don't cover the sale total." };
    }
    if (msg.indexOf("not_authorized") !== -1) {
      return { error: "You don't have access to record this sale." };
    }
    if (msg.indexOf("duplicate key") !== -1 || (rpcError && (rpcError as { code?: string }).code === "23505")) {
      if (idemKey) {
        const { data: dup } = await supabase
          .from("orders")
          .select("id, sale_number")
          .eq("business_id", business.id)
          .eq("idempotency_key", idemKey)
          .maybeSingle();
        if (dup) {
          return { ok: true, id: dup.id as string, sale_number: Number(dup.sale_number) };
        }
      }
    }
    console.error("createOrder rpc:", rpcError);
    return { error: "Could not record the sale. Please try again." };
  }

  const result = rpcData as { order_id: string; sale_number: number | string; replayed?: boolean };

  // P2-31: accrue loyalty points for a named customer. Additive and post-settle —
  // it never touches the order's money or snapshot. Skipped on idempotent replays
  // (so a retried request can't double-earn) and for training sales.
  if (customerId && !isTraining && !result.replayed) {
    await accrueLoyaltyPoints(supabase, business.id, customerId, result.order_id, netSubtotal);
  }

  revalidatePath("/app/pos");
  return { ok: true, id: result.order_id, sale_number: Number(result.sale_number) };
}

// Earn points = floor(net pre-tax spend × earn-per-dollar). Writes an append-only
// ledger row and bumps the running balance. Best-effort: a failure here must not
// fail the (already-recorded) sale.
async function accrueLoyaltyPoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  customerId: string,
  orderId: string,
  netSubtotal: number
): Promise<void> {
  try {
    const { data: biz } = await supabase
      .from("businesses")
      .select("loyalty_settings")
      .eq("id", businessId)
      .maybeSingle();
    const ls = (biz?.loyalty_settings ?? {}) as { enabled?: boolean; earnPerDollar?: number };
    if (ls.enabled !== true) return;
    const earnPerDollar = Number(ls.earnPerDollar);
    if (!Number.isFinite(earnPerDollar) || earnPerDollar <= 0) return;

    const points = Math.floor((Number(netSubtotal) || 0) * earnPerDollar);
    if (points <= 0) return;

    await supabase
      .from("loyalty_transactions")
      .insert({ business_id: businessId, customer_id: customerId, order_id: orderId, points, kind: "earn" });

    const { data: acct } = await supabase
      .from("loyalty_accounts")
      .select("points")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (acct) {
      await supabase
        .from("loyalty_accounts")
        .update({ points: (acct.points as number) + points, updated_at: new Date().toISOString() })
        .eq("business_id", businessId)
        .eq("customer_id", customerId);
    } else {
      await supabase
        .from("loyalty_accounts")
        .insert({ business_id: businessId, customer_id: customerId, points });
    }
  } catch (e) {
    console.error("accrueLoyaltyPoints:", e);
  }
}

export async function voidOrder(
  orderId: string,
  reasonCode: string,
  reasonNote?: string,
  approverPin?: string
): Promise<{ ok: true } | { needs_approval: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can void a sale." };
  }

  const code = (reasonCode || "").trim();
  if (!isValidReason(VOID_REASONS, code)) {
    return { error: "Choose a reason for voiding this sale." };
  }
  const note = (reasonNote || "").trim();
  if (code === "other" && !note) {
    return { error: "Add a note explaining the reason." };
  }

  const supabase = await createClient();

  const active = await getActiveStaffRow(supabase, business.id);
  let approver: { id: string; name: string } | null = null;
  if (active && (active.role === "staff" || active.role === "trainee")) {
    if (!approverPin) return { needs_approval: true };
    approver = await getManagerByPin(supabase, business.id, approverPin);
    if (!approver) return { error: "Manager PIN not recognized." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("orders")
    .update({ status: "voided" })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("voidOrder:", error);
    return { error: "Could not void the sale. Please try again." };
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    business_id: business.id,
    actor_id: user ? user.id : null,
    actor_role: role,
    action: "void",
    order_id: orderId,
    reason_code: code,
    reason_note: note ? note.slice(0, 500) : null,
    metadata: {
      staff_id: active ? active.id : null,
      staff_name: active ? active.name : null,
      approved_by: approver ? approver.id : null,
      approver_name: approver ? approver.name : null,
    },
  });
  if (auditError) {
    console.error("voidOrder audit:", auditError);
  }

  revalidatePath("/app/pos/sales");
  return { ok: true };
}

export async function searchCustomers(
  query: string
): Promise<{ id: string; name: string; phone: string | null; tax_exempt: boolean }[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  let q = supabase
    .from("customers")
    .select("id, name, phone, tax_exempt")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(10);

  const term = (query || "").trim().replace(/[(),]/g, " ").trim();
  if (term) {
    const like = "%" + term + "%";
    q = q.or("name.ilike." + like + ",phone.ilike." + like);
  }

  const { data, error } = await q;
  if (error) {
    console.error("searchCustomers:", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    tax_exempt: (c.tax_exempt as boolean | null) === true,
  }));
}

export async function quickCreateCustomer(
  name: string,
  phone?: string
): Promise<{ ok: true; id: string; name: string } | { error: string }> {
  const clean = (name || "").trim();
  if (!clean) return { error: "Customer name is required." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: business.id,
      name: clean.slice(0, 120),
      phone: phone && phone.trim() ? phone.trim().slice(0, 40) : null,
    })
    .select("id, name")
    .single();

  if (error || !data) {
    console.error("quickCreateCustomer:", error);
    return { error: "Could not add customer. Please try again." };
  }

  revalidatePath("/app/customers");
  return { ok: true, id: data.id as string, name: data.name as string };
}