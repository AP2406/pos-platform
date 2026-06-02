"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { z } from "zod";

const cartLineSchema = z.object({
  catalog_item_id: z.string().uuid().optional().nullable(),
  variation_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit_price: z.coerce.number().min(0).max(1000000),
  quantity: z.coerce.number().int().min(1).max(1000),
});

const customerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(120),
});

const cartSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Nothing to hold."),
  tip: z.string().max(20).optional(),
  discount_mode: z.enum(["amount", "percent"]).optional(),
  discount_value: z.string().max(20).optional(),
  discount_reason: z.string().max(60).optional(),
  discount_reason_note: z.string().max(500).optional(),
  customer: customerSchema.nullable().optional(),
});

type CartInput = z.infer<typeof cartSchema>;

export type OpenTicketSummary = {
  id: string;
  label: string | null;
  item_count: number;
  subtotal: number;
  created_at: string;
  cart: CartInput;
};

export async function holdTicket(input: {
  label?: string | null;
  cart: CartInput;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const parsed = cartSchema.safeParse(input.cart);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nothing to hold." };
  }

  const { business } = await requireBusiness();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const label =
    input.label && input.label.trim() ? input.label.trim().slice(0, 80) : null;

  const { data, error } = await supabase
    .from("open_tickets")
    .insert({
      business_id: business.id,
      label: label,
      cart: parsed.data,
      created_by: user ? user.id : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("holdTicket:", error);
    return { error: "Could not hold the ticket. Please try again." };
  }

  return { ok: true, id: data.id as string };
}

export async function listOpenTickets(): Promise<OpenTicketSummary[]> {
  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, cart, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("listOpenTickets:", error);
    return [];
  }

  return (data ?? []).map((t) => {
    const cart = (t.cart as CartInput) || { items: [] };
    const items = Array.isArray(cart.items) ? cart.items : [];
    let itemCount = 0;
    let subtotal = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      itemCount += qty;
      subtotal += (Number(it.unit_price) || 0) * qty;
    }
    return {
      id: t.id as string,
      label: (t.label as string | null) ?? null,
      item_count: itemCount,
      subtotal: Math.round(subtotal * 100) / 100,
      created_at: t.created_at as string,
      cart: cart,
    };
  });
}

export async function resumeTicket(
  ticketId: string
): Promise<{ ok: true; cart: CartInput } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("open_tickets")
    .select("id, cart")
    .eq("id", ticketId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!ticket) return { error: "That ticket is no longer open." };

  const { error: delError } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("business_id", business.id);
  if (delError) {
    console.error("resumeTicket delete:", delError);
    return { error: "Could not resume the ticket. Please try again." };
  }

  return { ok: true, cart: (ticket.cart as CartInput) || { items: [] } };
}

export async function discardTicket(
  ticketId: string
): Promise<{ ok: true } | { error: string }> {
  if (!ticketId) return { error: "Missing ticket." };

  const { business } = await requireBusiness();
  const supabase = await createClient();

  const { error } = await supabase
    .from("open_tickets")
    .delete()
    .eq("id", ticketId)
    .eq("business_id", business.id);

  if (error) {
    console.error("discardTicket:", error);
    return { error: "Could not discard the ticket. Please try again." };
  }

  return { ok: true };
}