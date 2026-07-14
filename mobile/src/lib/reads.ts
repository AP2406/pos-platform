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

// ---- Floor map (same layout data the web floor renders) ---------------------

export type FloorBackground = { type: "color" | "image"; value: string } | null;
export type FloorPlan = { id: string; name: string; sortOrder: number; background: FloorBackground };

function parseBackground(raw: unknown): FloorBackground {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as { type?: unknown; value?: unknown };
  if ((b.type === "color" || b.type === "image") && typeof b.value === "string") return { type: b.type, value: b.value };
  return null;
}

export async function fetchFloorPlans(businessId: string): Promise<FloorPlan[]> {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("id, name, sort_order, background")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.name as string) || "Floor",
    sortOrder: Number(p.sort_order) || 0,
    background: parseBackground((p as { background?: unknown }).background),
  }));
}

export type FloorElement = {
  id: string;
  kind: string;
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  shape: string;
  planId: string | null;
  sectionId: string | null;
  parentId: string | null;
  seatNo: number | null;
};

export async function fetchFloorElements(businessId: string, planId: string): Promise<FloorElement[]> {
  const { data, error } = await supabase
    .from("floor_elements")
    .select("id, kind, label, x, y, w, h, rotation, shape, plan_id, section_id, parent_id, seat_no, is_active")
    .eq("business_id", businessId)
    .eq("plan_id", planId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id as string,
    kind: (e.kind as string) || "table",
    label: (e.label as string | null) ?? null,
    x: Number(e.x) || 0,
    y: Number(e.y) || 0,
    w: Number(e.w) || 80,
    h: Number(e.h) || 80,
    rotation: Number(e.rotation) || 0,
    shape: (e.shape as string) || "rect",
    planId: (e.plan_id as string | null) ?? null,
    sectionId: (e.section_id as string | null) ?? null,
    parentId: (e.parent_id as string | null) ?? null,
    seatNo: e.seat_no == null ? null : Number(e.seat_no),
  }));
}

export type FloorSection = { id: string; name: string; color: string | null; planId: string | null };

export async function fetchSections(businessId: string): Promise<FloorSection[]> {
  const { data, error } = await supabase
    .from("floor_sections")
    .select("id, name, color, plan_id")
    .eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) || "Section",
    color: (s.color as string | null) ?? null,
    planId: (s.plan_id as string | null) ?? null,
  }));
}

// Live per-table summary, bound by open_tickets.element_id (exactly like the web).
export type TableSummary = {
  elementId: string;
  ticketId: string;
  openedAt: string;
  guests: number;
  subtotal: number;
  itemCount: number;
  checkDropped: boolean;
};

export async function fetchTableSummaries(businessId: string): Promise<Record<string, TableSummary>> {
  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, element_id, opened_at, guest_count, cart, check_dropped_at")
    .eq("business_id", businessId)
    .not("element_id", "is", null);
  if (error) throw error;
  const byElement: Record<string, TableSummary> = {};
  for (const t of data ?? []) {
    const cart = (t.cart ?? null) as { items?: Array<{ unit_price?: number; quantity?: number }> } | null;
    const items = Array.isArray(cart?.items) ? cart!.items : [];
    let subtotal = 0;
    let itemCount = 0;
    for (const it of items) {
      const q = Number(it.quantity) || 0;
      subtotal += (Number(it.unit_price) || 0) * q;
      itemCount += q;
    }
    byElement[t.element_id as string] = {
      elementId: t.element_id as string,
      ticketId: t.id as string,
      openedAt: t.opened_at as string,
      guests: Number(t.guest_count) || 0,
      subtotal: Math.round(subtotal * 100) / 100,
      itemCount,
      checkDropped: t.check_dropped_at != null,
    };
  }
  return byElement;
}

export type Aging = { yellowMin: number; redMin: number };

// Turn-time thresholds from businesses.settings.table_aging (fallback 60 / 90).
export async function fetchTableAging(businessId: string): Promise<Aging> {
  const { data } = await supabase.from("businesses").select("settings").eq("id", businessId).maybeSingle();
  const ta = ((data?.settings ?? {}) as { table_aging?: { yellow_min?: number; red_min?: number } }).table_aging ?? {};
  return { yellowMin: Number(ta.yellow_min) || 60, redMin: Number(ta.red_min) || 90 };
}

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
