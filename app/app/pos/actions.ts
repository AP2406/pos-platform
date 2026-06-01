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
};

export async function createOrder(
  input: OrderInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const subtotal = parsed.data.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );

  // Tax rate may be stored as 0.13 or as 13 — handle both safely.
  let rate = Number(business.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const tax = Math.round(subtotal * rate * 100) / 100;
  const tip = parsed.data.tip ?? 0;
  const total = Math.round((subtotal + tax + tip) * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      status: "paid",
      subtotal,
      tax,
      tip,
      total,
      payment_method: parsed.data.payment_method ?? "cash",
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
  return { ok: true, id: order.id };
}