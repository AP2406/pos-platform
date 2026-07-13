import { supabase } from "./supabase";

// Direct Supabase reads (RLS enforces tenancy). All money WRITES go through the
// v1 HTTP API; these are pure reads for the floor + register.

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  imageUrl: string | null;
  outOfStock: boolean;
};

export async function fetchMenu(businessId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, price, category, image_url, out_of_stock, is_active")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) || "Item",
    price: Number(r.price) || 0,
    category: (r.category as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    outOfStock: (r.out_of_stock as boolean | null) === true,
  }));
}

export type OpenCheck = {
  id: string;
  label: string;
  ticketType: string | null;
  channel: string | null;
  guests: number;
  openedAt: string;
  checkDropped: boolean;
  customerPhone: string | null;
};

export async function fetchOpenChecks(businessId: string): Promise<OpenCheck[]> {
  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, ticket_type, guest_count, channel, opened_at, check_dropped_at, customer_phone")
    .eq("business_id", businessId)
    .order("opened_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id as string,
    label: (t.label as string) || "Ticket",
    ticketType: (t.ticket_type as string | null) ?? null,
    channel: (t.channel as string | null) ?? null,
    guests: Number(t.guest_count) || 0,
    openedAt: t.opened_at as string,
    checkDropped: t.check_dropped_at != null,
    customerPhone: (t.customer_phone as string | null) ?? null,
  }));
}

export type CheckLine = {
  catalogItemId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
  seat: number | null;
};

// Read an existing open check's cart lines (jsonb) so the register can resume it.
export async function fetchCheckCart(ticketId: string): Promise<CheckLine[]> {
  const { data, error } = await supabase.from("open_tickets").select("cart").eq("id", ticketId).maybeSingle();
  if (error) throw error;
  const cart = (data?.cart ?? null) as { items?: Array<Record<string, unknown>> } | null;
  const items = Array.isArray(cart?.items) ? cart!.items : [];
  return items.map((it) => ({
    catalogItemId: (it.catalog_item_id as string | null) ?? null,
    name: String(it.name ?? "Item"),
    unitPrice: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    note: (it.note as string | null) ?? null,
    seat: it.seat == null ? null : Number(it.seat),
  }));
}
