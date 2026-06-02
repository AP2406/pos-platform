"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  customer_id: z.string().uuid().optional().nullable(),
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
  customer_id?: string | null;
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

  const { business } = await requireBusiness();
  const supabase = await createClient();

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

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;

  let rate = Number(business.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const tax = Math.round(discountedSubtotal * rate * 100) / 100;
  const tip = parsed.data.tip ?? 0;
  const total = Math.round((discountedSubtotal + tax + tip) * 100) / 100;
  const paymentMethod = parsed.data.payment_method ?? "cash";

  // Resolve tender lines. If the register sent an explicit split, validate it
  // covers the total to the cent; otherwise record a single payment for the
  // whole total using the chosen method. Cash lines may carry a "tendered"
  // amount (cash handed over) so change can be recorded.
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
    discount: { type: discountType, value: discountValue, amount: discount },
    tax: { rate: rate, amount: tax },
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
      snapshot: snapshot,
    })
    .select("id")
    .single();

  if (orderError || !order) {
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

  // Decrement stock for tracked items. A completed sale must never fail because
  // of inventory bookkeeping, so problems here are logged, not surfaced.
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

  revalidatePath("/app/pos");
  return { ok: true, id: order.id, sale_number: saleNumber };
}

export async function voidOrder(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  if (!orderId) return { error: "Missing order." };

  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can void a sale." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "voided" })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (error) {
    console.error("voidOrder:", error);
    return { error: "Could not void the sale. Please try again." };
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