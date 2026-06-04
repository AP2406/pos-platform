"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { VOID_REASONS, DISCOUNT_REASONS, isValidReason } from "./reason-codes";

const lineSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
});

const paymentLineSchema = z.object({
  method: z.enum(["cash", "card", "other"]),
  amount: z.coerce.number().min(0).max(1000000),
  tendered: z.coerce.number().min(0).max(1000000).optional().nullable(),
});

const orderSchema = z.object({
  items: z.array(lineSchema).min(1, "Add at least one item."),
  tip: z.coerce.number().min(0).max(1000000).optional(),
  payment_method: z.enum(["cash", "card", "other"]).optional(),
  payments: z.array(paymentLineSchema).optional(),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  discount_reason_code: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  idempotency_key: z.string().uuid().optional(),
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
  tip?: number;
  payment_method?: "cash" | "card" | "other";
  payments?: PaymentInput[];
  discount_type?: "amount" | "percent";
  discount_value?: number;
  discount_reason_code?: string;
  discount_reason_note?: string;
  customer_id?: string | null;
  idempotency_key?: string;
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

export async function createOrder(input: OrderInput): Promise<CreateOrderResult> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { business, role } = await requireBusiness();
  const isTraining = (business as { training_mode?: boolean }).training_mode === true;
  const supabase = await createClient();

  // Idempotency: if this exact checkout was already recorded, return that sale
  // instead of creating a duplicate. This catches double-clicks and retries
  // before we even touch a sale number.
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
  if (customerId) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (cust) {
      customerName = (cust.name as string | null) ?? null;
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

  // Active staff: the PIN-identified operator on this device, if any.
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

  // Per-item tax. Each catalog item uses the business default rate, a named
  // rate, or is tax-exempt. Custom lines (no catalog item) use the default rate.
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

  const taxF = subtotal > 0 ? discountedSubtotal / subtotal : 0;

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

  const tip = parsed.data.tip ?? 0;
  const total = Math.round((discountedSubtotal + tax + tip) * 100) / 100;
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

  const { data: numData, error: numError } = await supabase.rpc(
    "next_sale_number",
    { p_business_id: business.id }
  );
  if (numError || numData === null || numData === undefined) {
    console.error("next_sale_number:", numError);
    return { error: "Could not generate a sale number. Please try again." };
  }
  const saleNumber = Number(numData);

  const snapshot = {
    sale_number: saleNumber,
    items: parsed.data.items.map((i) => ({
      name: i.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    discount: {
      type: discountType,
      value: discountValue,
      amount: discount,
      reason_code: discount > 0 ? discountReasonCode : null,
      reason_note: discount > 0 && discountReasonNote ? discountReasonNote : null,
    },
    tax: { rate: rate, amount: tax, taxable_base: taxableBase, breakdown: taxBreakdown },
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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      status: "paid",
      sale_number: saleNumber,
      subtotal,
      discount,
      tax,
      tip,
      total,
      payment_method: orderPaymentMethod,
      customer_id: customerId,
      drawer_session_id: drawerSessionId,
      staff_id: activeStaffId,
      is_training: isTraining,
      idempotency_key: idemKey,
      snapshot: snapshot,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    // If two requests with the same key raced, the unique index rejects the
    // loser. Recover the sale the winner already created instead of erroring.
    if (idemKey && orderError && (orderError as { code?: string }).code === "23505") {
      const { data: dup } = await supabase
        .from("orders")
        .select("id, sale_number")
        .eq("business_id", business.id)
        .eq("idempotency_key", idemKey)
        .maybeSingle();
      if (dup) {
        return {
          ok: true,
          id: dup.id as string,
          sale_number: Number(dup.sale_number),
        };
      }
    }
    console.error("createOrder:", orderError);
    return { error: "Could not record the sale. Please try again." };
  }

  const lines = parsed.data.items.map((i) => ({
    order_id: order.id,
    business_id: business.id,
    catalog_item_id: i.catalog_item_id ?? null,
    name: i.name,
    unit_price: i.unit_price,
    quantity: i.quantity,
  }));

  const { error: linesError } = await supabase.from("order_items").insert(lines);
  if (linesError) {
    console.error("createOrder lines:", linesError);
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "Could not save the order. Please try again." };
  }

  const paymentRows = tenders.map((t) => ({
    business_id: business.id,
    order_id: order.id,
    method: t.method,
    amount: t.amount,
    tendered: t.tendered,
    change_given: t.change,
  }));

  const { error: payError } = await supabase.from("payments").insert(paymentRows);
  if (payError) {
    console.error("createOrder payments:", payError);
    await supabase.from("order_items").delete().eq("order_id", order.id);
    await supabase.from("orders").delete().eq("id", order.id);
    return { error: "Could not record payment. Please try again." };
  }

  // Log the discount as a sensitive action. Practice sales are skipped so the
  // activity log stays clean. The sale is already committed, so a failed audit
  // write is logged, not surfaced.
  if (discount > 0 && !isTraining) {
    const {
      data: { user: discUser },
    } = await supabase.auth.getUser();
    const { error: discAuditError } = await supabase.from("audit_events").insert({
      business_id: business.id,
      actor_id: discUser ? discUser.id : null,
      actor_role: role,
      action: "discount",
      order_id: order.id,
      reason_code: discountReasonCode,
      reason_note: discountReasonNote ? discountReasonNote.slice(0, 500) : null,
      metadata: { type: discountType, value: discountValue, amount: discount, staff_id: activeStaffId, staff_name: activeStaffName },
    });
    if (discAuditError) {
      console.error("createOrder discount audit:", discAuditError);
    }
  }

  // Decrement stock for tracked items. Practice (training) sales must not touch
  // real inventory. A completed sale must never fail because of inventory
  // bookkeeping, so problems here are logged, not surfaced.
  if (!isTraining) {
    try {
      const itemIds = Array.from(
        new Set(
          parsed.data.items
            .map((i) => i.catalog_item_id)
            .filter((id): id is string => !!id)
        )
      );
      if (itemIds.length > 0) {
        const { data: tracked } = await supabase
          .from("catalog_items")
          .select("id, track_inventory")
          .eq("business_id", business.id)
          .in("id", itemIds);

        const trackedSet = new Set(
          (tracked ?? []).filter((r) => r.track_inventory).map((r) => r.id as string)
        );

        const qtyByItem: Record<string, number> = {};
        for (const line of parsed.data.items) {
          const id = line.catalog_item_id;
          if (id && trackedSet.has(id)) {
            qtyByItem[id] = (qtyByItem[id] || 0) + line.quantity;
          }
        }

        for (const id of Object.keys(qtyByItem)) {
          const qty = qtyByItem[id];
          const { error: invError } = await supabase.rpc("apply_inventory_change", {
            p_business_id: business.id,
            p_item_id: id,
            p_change: -qty,
            p_reason: "sale",
            p_note: null,
            p_order_id: order.id,
          });
          if (invError) {
            console.error("inventory decrement (order " + order.id + ", item " + id + "):", invError);
          }
        }
      }
    } catch (e) {
      console.error("inventory decrement block:", e);
    }
  }

  revalidatePath("/app/pos");
  return { ok: true, id: order.id, sale_number: saleNumber };
}

export async function voidOrder(
  orderId: string,
  reasonCode: string,
  reasonNote?: string
): Promise<{ ok: true } | { error: string }> {
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
    metadata: {},
  });
  if (auditError) {
    console.error("voidOrder audit:", auditError);
  }

  revalidatePath("/app/pos/sales");
  return { ok: true };
}

export async function searchCustomers(
  query: string
): Promise<{ id: string; name: string; phone: string | null }[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  let q = supabase
    .from("customers")
    .select("id, name, phone")
    .eq("business_id", business.id)
    .order("name", { ascending: true })
    .limit(10);

  const term = (query || "").trim();
  if (term) q = q.ilike("name", "%" + term + "%");

  const { data, error } = await q;
  if (error) {
    console.error("searchCustomers:", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
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