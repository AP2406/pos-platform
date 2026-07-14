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
  staffId: string | null;
};

export async function fetchOpenChecks(businessId: string): Promise<OpenCheck[]> {
  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, label, ticket_type, guest_count, channel, opened_at, check_dropped_at, customer_phone, staff_id")
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
    staffId: (t.staff_id as string | null) ?? null,
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
  staffId: string | null;
};

export async function fetchTableSummaries(businessId: string): Promise<Record<string, TableSummary>> {
  const { data, error } = await supabase
    .from("open_tickets")
    .select("id, element_id, opened_at, guest_count, cart, check_dropped_at, staff_id")
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
      staffId: (t.staff_id as string | null) ?? null,
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

// ---- Orders hub (fulfillment) -----------------------------------------------

export type OrderHubRow = {
  id: string;
  saleNumber: number | null;
  channel: string | null;
  diningOption: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  total: number;
  customerName: string | null;
};

// Today's non-voided orders for the fulfillment hub (channel-segmented).
export async function fetchOrdersHub(businessId: string): Promise<OrderHubRow[]> {
  const sinceIso = new Date(new Date().toDateString()).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id, sale_number, channel, dining_option, created_at, fulfilled_at, total, customer:customers(name)")
    .eq("business_id", businessId)
    .neq("is_training", true)
    .neq("status", "voided")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((o) => {
    const cust = o.customer as { name?: string } | { name?: string }[] | null;
    const name = (Array.isArray(cust) ? cust[0]?.name : cust?.name) ?? null;
    return {
      id: o.id as string,
      saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
      channel: (o.channel as string | null) ?? null,
      diningOption: (o.dining_option as string | null) ?? null,
      createdAt: o.created_at as string,
      fulfilledAt: (o.fulfilled_at as string | null) ?? null,
      total: Number(o.total) || 0,
      customerName: name,
    };
  });
}

// ---- Order history (read-only) ----------------------------------------------

export type SaleStatus = "paid" | "voided" | "refunded";
export type SaleRow = {
  id: string;
  saleNumber: number | null;
  createdAt: string;
  total: number;
  method: string;
  status: SaleStatus;
  customerName: string | null;
  serverName: string | null;
};

export async function fetchSalesHistory(businessId: string, sinceIso: string): Promise<SaleRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, sale_number, created_at, total, payment_method, status, customer:customers(name), server:staff_members(name)")
    .eq("business_id", businessId)
    .neq("is_training", true)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((o) => o.id as string);
  const refunded = new Set<string>();
  if (ids.length > 0) {
    const { data: rf } = await supabase.from("refunds").select("order_id").eq("business_id", businessId).in("order_id", ids);
    for (const r of rf ?? []) refunded.add(r.order_id as string);
  }
  return rows.map((o) => {
    const cust = o.customer as { name?: string } | { name?: string }[] | null;
    const srv = o.server as { name?: string } | { name?: string }[] | null;
    const oneName = (v: typeof cust) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;
    const status: SaleStatus = o.status === "voided" ? "voided" : refunded.has(o.id as string) ? "refunded" : "paid";
    return {
      id: o.id as string,
      saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
      createdAt: o.created_at as string,
      total: Number(o.total) || 0,
      method: (o.payment_method as string | null) ?? "cash",
      status,
      customerName: oneName(cust),
      serverName: oneName(srv),
    };
  });
}

export type SaleDetailLine = { name: string; quantity: number; unitPrice: number; note: string | null };
export type SaleDetail = {
  id: string;
  saleNumber: number | null;
  createdAt: string;
  status: SaleStatus;
  diningOption: string | null;
  customerName: string | null;
  serverName: string | null;
  subtotal: number;
  discount: number;
  comp: number;
  tax: number;
  tip: number;
  total: number;
  items: SaleDetailLine[];
  payments: { method: string; amount: number }[];
  refunds: { amount: number; reasonCode: string | null }[];
};

export async function fetchOrderDetail(businessId: string, orderId: string): Promise<SaleDetail | null> {
  const { data: o } = await supabase
    .from("orders")
    .select("id, sale_number, created_at, status, dining_option, subtotal, discount, comp, tax, tip, total, snapshot, customer:customers(name), server:staff_members(name)")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!o) return null;
  const [{ data: pays }, { data: refs }] = await Promise.all([
    supabase.from("payments").select("method, amount").eq("business_id", businessId).eq("order_id", orderId),
    supabase.from("refunds").select("amount, reason_code").eq("business_id", businessId).eq("order_id", orderId),
  ]);
  const snap = (o.snapshot ?? null) as { items?: Array<Record<string, unknown>> } | null;
  const items = Array.isArray(snap?.items) ? snap!.items : [];
  const cust = o.customer as { name?: string } | { name?: string }[] | null;
  const srv = o.server as { name?: string } | { name?: string }[] | null;
  const oneName = (v: typeof cust) => (Array.isArray(v) ? v[0]?.name : v?.name) ?? null;
  const refundTotal = (refs ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return {
    id: o.id as string,
    saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
    createdAt: o.created_at as string,
    status: o.status === "voided" ? "voided" : refundTotal > 0 ? "refunded" : "paid",
    diningOption: (o.dining_option as string | null) ?? null,
    customerName: oneName(cust),
    serverName: oneName(srv),
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    comp: Number(o.comp) || 0,
    tax: Number(o.tax) || 0,
    tip: Number(o.tip) || 0,
    total: Number(o.total) || 0,
    items: items.map((it) => ({
      name: String(it.name ?? "Item"),
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unit_price) || 0,
      note: (it.note as string | null) ?? null,
    })),
    payments: (pays ?? []).map((p) => ({ method: (p.method as string) || "other", amount: Number(p.amount) || 0 })),
    refunds: (refs ?? []).map((r) => ({ amount: Number(r.amount) || 0, reasonCode: (r.reason_code as string | null) ?? null })),
  };
}

// ---- KDS (kitchen display) --------------------------------------------------

export type KdsItem = { name: string; quantity: number; note: string | null; allergens: string[] };
export type KitchenTicket = {
  id: string;
  label: string | null;
  items: KdsItem[];
  firedAt: string;
  fulfilledAt: string | null;
  stationId: string | null;
  courseId: string | null;
  rush: boolean;
  elementId: string | null;
};

export type KitchenStation = { id: string; name: string };

function parseKdsItems(raw: unknown): KdsItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const al = o.allergens;
    return {
      name: String(o.name ?? "Item"),
      quantity: Number(o.quantity) || 1,
      note: (o.note as string | null) ?? null,
      allergens: Array.isArray(al) ? al.map((a) => String(a)) : [],
    };
  });
}

// Open (unbumped) tickets + those bumped in the last ~30 min (for the recall strip).
export async function fetchKitchenTickets(businessId: string): Promise<KitchenTicket[]> {
  const sinceIso = new Date(Date.now() - 30 * 60000).toISOString();
  const { data, error } = await supabase
    .from("kitchen_tickets")
    .select("id, label, items, fired_at, fulfilled_at, station_id, course_id, rush, element_id")
    .eq("business_id", businessId)
    .or(`fulfilled_at.is.null,fulfilled_at.gt.${sinceIso}`)
    .order("fired_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id as string,
    label: (t.label as string | null) ?? null,
    items: parseKdsItems(t.items),
    firedAt: t.fired_at as string,
    fulfilledAt: (t.fulfilled_at as string | null) ?? null,
    stationId: (t.station_id as string | null) ?? null,
    courseId: (t.course_id as string | null) ?? null,
    rush: (t.rush as boolean | null) === true,
    elementId: (t.element_id as string | null) ?? null,
  }));
}

export async function fetchKitchenStations(businessId: string): Promise<KitchenStation[]> {
  const { data, error } = await supabase
    .from("kitchen_stations")
    .select("id, name")
    .eq("business_id", businessId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id as string, name: (s.name as string) || "Station" }));
}

// Kitchen aging thresholds from businesses.settings.kds (fallback 10 / 18 min).
export async function fetchKdsAging(businessId: string): Promise<Aging> {
  const { data } = await supabase.from("businesses").select("settings").eq("id", businessId).maybeSingle();
  const kds = ((data?.settings ?? {}) as { kds?: { warnMin?: number; lateMin?: number } }).kds ?? {};
  return { yellowMin: Number(kds.warnMin) || 10, redMin: Number(kds.lateMin) || 18 };
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
