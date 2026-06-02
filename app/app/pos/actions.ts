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

const orderSchema = z.object({
  items: z.array(lineSchema).min(1, "Add at least one item."),
  tip: z.coerce.number().min(0).max(1000000).optional(),
  payment_method: z.enum(["cash", "card", "other"]).optional(),
  discount_type: z.enum(["amount", "percent"]).optional(),
  discount_value: z.coerce.number().min(0).max(1000000).optional(),
  customer_id: z.string().uuid().optional().nullable(),
});

type OrderInput = {
  items: {
    catalog_item_id?: string | null;
    name: string;
    unit_price: number;
    quantity: number;
  }[];
  tip?: number;
  payment_method?: "cash" | "card" | "other";
  discount_type?: "amount" | "percent";
  discount_value?: number;
  customer_id?: string | null;
};

export async function createOrder(
  input: OrderInput
): Promise<{ ok: true; id: string; sale_number: number } | { error: string }> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  // If a customer was attached, confirm it belongs to this business and
  // capture the name so the snapshot freezes it.
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

  // Tax rate may be stored as 0.13 or as 13 - handle both safely.
  let rate = Number(business.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const tax = Math.round(discountedSubtotal * rate * 100) / 100;
  const tip = parsed.data.tip ?? 0;
  const total = Math.round((discountedSubtotal + tax + tip) * 100) / 100;
  const paymentMethod = parsed.data.payment_method ?? "cash";

  // Concurrency-safe per-business sale number (atomic in the database).
  const { data: numData, error: numError } = await supabase.rpc(
    "next_sale_number",
    { p_business_id: business.id }
  );
  if (numError || numData === null || numData === undefined) {
    console.error("next_sale_number:", numError);
    return { error: "Could not generate a sale number. Please try again." };
  }
  const saleNumber = Number(numData);

  // Immutable snapshot of the sale exactly as completed.
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
    payment_method: paymentMethod,
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
      payment_method: paymentMethod,
      customer_id: customerId,
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