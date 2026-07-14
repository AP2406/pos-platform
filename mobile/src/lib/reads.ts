import { supabase } from "./supabase";
import type { ModOption, ModifierGroup, Variation } from "./modifiers";

// Direct Supabase reads (RLS enforces tenancy). All money WRITES go through the
// v1 HTTP API; these are pure reads for the floor + register.

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  imageUrl: string | null;
  outOfStock: boolean;
  defaultCourseId: string | null;
  variations: Variation[];
  // Nested modifier group tree (forced/required, min/max, half-split, follow-ups).
  modifierGroups: ModifierGroup[];
};

// Build each item's modifier group tree exactly like the web POS (page.tsx):
// flat catalog_item_modifiers point at catalog_modifier_groups; an option's
// child_group_id nests a follow-up group (depth-capped); items with only loose
// modifiers get one non-required "Add-ons" group.
function buildModifierMaps(
  mods: { id: string; catalog_item_id: string; name: string; price: number; group_id: string | null; child_group_id: string | null }[],
  groups: { id: string; catalog_item_id: string; name: string; required: boolean; min_select: number; max_select: number | null; allow_split: boolean }[]
): Record<string, ModifierGroup[]> {
  type RawOpt = { id: string; name: string; price: number; child_group_id: string | null };
  const optsByGroup: Record<string, RawOpt[]> = {};
  const looseByItem: Record<string, RawOpt[]> = {};
  for (const m of mods) {
    const ro: RawOpt = { id: m.id, name: m.name, price: Number(m.price) || 0, child_group_id: m.child_group_id ?? null };
    if (m.group_id) (optsByGroup[m.group_id] ??= []).push(ro);
    else (looseByItem[m.catalog_item_id] ??= []).push(ro);
  }
  const rawGroupById = new Map<string, (typeof groups)[number]>();
  const groupIdsByItem: Record<string, string[]> = {};
  for (const g of groups) {
    rawGroupById.set(g.id, g);
    (groupIdsByItem[g.catalog_item_id] ??= []).push(g.id);
  }
  const childGroupIds = new Set<string>();
  for (const arr of Object.values(optsByGroup)) for (const o of arr) if (o.child_group_id) childGroupIds.add(o.child_group_id);

  function build(groupId: string, depth: number, seen: Set<string>): ModifierGroup | null {
    const rg = rawGroupById.get(groupId);
    if (!rg) return null;
    const options: ModOption[] = (optsByGroup[groupId] ?? []).map((o) => {
      let child: ModifierGroup | undefined;
      if (o.child_group_id && depth < 3 && !seen.has(o.child_group_id)) {
        const c = build(o.child_group_id, depth + 1, new Set([...seen, groupId]));
        if (c && c.options.length > 0) child = c;
      }
      return { id: o.id, name: o.name, price: o.price, child_group: child };
    });
    return { id: rg.id, name: rg.name, required: rg.required, min_select: Number(rg.min_select) || 0, max_select: rg.max_select == null ? null : Number(rg.max_select), allow_split: rg.allow_split, options };
  }

  const byItem: Record<string, ModifierGroup[]> = {};
  const itemIds = new Set([...Object.keys(groupIdsByItem), ...Object.keys(looseByItem)]);
  for (const itemId of itemIds) {
    const out: ModifierGroup[] = [];
    for (const gid of groupIdsByItem[itemId] ?? []) {
      if (childGroupIds.has(gid)) continue; // rendered nested, not top-level
      const g = build(gid, 0, new Set());
      if (g && g.options.length > 0) out.push(g);
    }
    const loose = looseByItem[itemId] ?? [];
    if (loose.length > 0) out.push({ id: "loose:" + itemId, name: "Add-ons", required: false, min_select: 0, max_select: null, allow_split: false, options: loose.map((o) => ({ id: o.id, name: o.name, price: o.price })) });
    byItem[itemId] = out;
  }
  return byItem;
}

export async function fetchMenu(businessId: string): Promise<MenuItem[]> {
  const [{ data, error }, { data: vars }, { data: mods }, { data: groups }] = await Promise.all([
    supabase
      .from("catalog_items")
      .select("id, name, price, category, image_url, out_of_stock, default_course_id, is_active")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("catalog_item_variations").select("id, catalog_item_id, name, price").eq("business_id", businessId).eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("catalog_item_modifiers").select("id, catalog_item_id, name, price, group_id, child_group_id, sort_order").eq("business_id", businessId).order("sort_order", { ascending: true }),
    supabase.from("catalog_modifier_groups").select("id, catalog_item_id, name, required, min_select, max_select, allow_split, sort_order").eq("business_id", businessId).order("sort_order", { ascending: true }),
  ]);
  if (error) throw error;

  const varsByItem: Record<string, Variation[]> = {};
  for (const v of vars ?? []) (varsByItem[v.catalog_item_id as string] ??= []).push({ id: v.id as string, name: (v.name as string) || "", price: Number(v.price) || 0 });

  const groupsByItem = buildModifierMaps(
    (mods ?? []).map((m) => ({ id: m.id as string, catalog_item_id: m.catalog_item_id as string, name: (m.name as string) || "", price: Number(m.price) || 0, group_id: (m.group_id as string | null) ?? null, child_group_id: (m.child_group_id as string | null) ?? null })),
    (groups ?? []).map((g) => ({ id: g.id as string, catalog_item_id: g.catalog_item_id as string, name: (g.name as string) || "", required: (g.required as boolean | null) ?? false, min_select: Number(g.min_select) || 0, max_select: g.max_select == null ? null : Number(g.max_select), allow_split: (g.allow_split as boolean | null) ?? false }))
  );

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) || "Item",
    price: Number(r.price) || 0,
    category: (r.category as string | null) ?? null,
    imageUrl: (r.image_url as string | null) ?? null,
    outOfStock: (r.out_of_stock as boolean | null) === true,
    defaultCourseId: (r.default_course_id as string | null) ?? null,
    variations: varsByItem[r.id as string] ?? [],
    modifierGroups: groupsByItem[r.id as string] ?? [],
  }));
}

export type Course = { id: string; name: string; sortOrder: number };

export async function fetchCourses(businessId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, sort_order")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id as string, name: (c.name as string) || "Course", sortOrder: Number(c.sort_order) || 0 }));
}

// E6 suggestive-selling: when a trigger item/category is rung, prompt an add-on.
export type UpsellPrompt = {
  triggerScope: "item" | "category";
  triggerItemId: string | null;
  triggerCategory: string | null;
  suggestItemId: string;
  label: string | null;
  comboDiscount: number; // $ off the suggested item when added from the prompt
};

export async function fetchUpsells(businessId: string): Promise<UpsellPrompt[]> {
  const { data, error } = await supabase
    .from("upsell_prompts")
    .select("trigger_scope, trigger_item_id, trigger_category, suggest_item_id, label, combo_discount")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    triggerScope: (r.trigger_scope as string) === "category" ? "category" : "item",
    triggerItemId: (r.trigger_item_id as string | null) ?? null,
    triggerCategory: (r.trigger_category as string | null) ?? null,
    suggestItemId: r.suggest_item_id as string,
    label: (r.label as string | null) ?? null,
    comboDiscount: Math.max(0, Number(r.combo_discount) || 0),
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

// ---- Time clock (staff state) -----------------------------------------------

export type MyShift = { onShift: boolean; onBreak: boolean; since: string | null; onBreakSince: string | null };

// The acting staff member's own open shift (if any).
export async function fetchMyShift(businessId: string, staffId: string): Promise<MyShift> {
  const { data } = await supabase
    .from("time_clock_entries")
    .select("clock_in, on_break_since")
    .eq("business_id", businessId)
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .maybeSingle();
  if (!data) return { onShift: false, onBreak: false, since: null, onBreakSince: null };
  return {
    onShift: true,
    onBreak: data.on_break_since != null,
    since: (data.clock_in as string | null) ?? null,
    onBreakSince: (data.on_break_since as string | null) ?? null,
  };
}

export type OnShiftRow = { staffId: string; name: string; since: string; onBreakSince: string | null };

// Everyone currently on the clock (glance for the whole floor).
export async function fetchOnShift(businessId: string): Promise<OnShiftRow[]> {
  const { data, error } = await supabase
    .from("time_clock_entries")
    .select("staff_id, clock_in, on_break_since, staff:staff_members(name)")
    .eq("business_id", businessId)
    .is("clock_out", null)
    .order("clock_in", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    return {
      staffId: r.staff_id as string,
      name: (staff?.name as string | undefined) ?? "Staff",
      since: r.clock_in as string,
      onBreakSince: (r.on_break_since as string | null) ?? null,
    };
  });
}

// ---- Reservations + waitlist (front-of-house state) -------------------------

export type ReservationRow = {
  id: string;
  guestName: string;
  partySize: number;
  phone: string | null;
  email: string | null;
  scheduledAt: string | null; // null = walk-in waitlist entry
  quotedWaitMin: number | null;
  elementId: string | null;
  status: string;
  notes: string | null;
  pagedAt: string | null;
  createdAt: string;
};

// Active bookings + waitlist (excludes closed-out rows), soonest first.
export async function fetchReservations(businessId: string): Promise<ReservationRow[]> {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, guest_name, party_size, phone, email, scheduled_at, quoted_wait_min, element_id, status, notes, paged_at, created_at")
    .eq("business_id", businessId)
    .in("status", ["booked", "waitlisted", "seated"])
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    guestName: (r.guest_name as string | null) ?? "",
    partySize: Number(r.party_size) || 1,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    scheduledAt: (r.scheduled_at as string | null) ?? null,
    quotedWaitMin: r.quoted_wait_min == null ? null : Number(r.quoted_wait_min),
    elementId: (r.element_id as string | null) ?? null,
    status: (r.status as string | null) ?? "booked",
    notes: (r.notes as string | null) ?? null,
    pagedAt: (r.paged_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

// ---- Customers (lookup; read-only) ------------------------------------------

export type CustomerRow = { id: string; name: string; phone: string | null; email: string | null };

// Search customers by name / phone / email (blank term = most recent).
export async function fetchCustomers(businessId: string, term: string): Promise<CustomerRow[]> {
  let q = supabase.from("customers").select("id, name, phone, email").eq("business_id", businessId);
  const t = term.trim();
  if (t) q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%,email.ilike.%${t}%`);
  const { data, error } = await q.order("name", { ascending: true }).limit(50);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id as string,
    name: (c.name as string | null) || "Guest",
    phone: (c.phone as string | null) ?? null,
    email: (c.email as string | null) ?? null,
  }));
}

export type CustomerDetail = CustomerRow & {
  notes: string | null;
  loyaltyPoints: number | null;
  storeCredit: number; // dollars
  visits: number;
  lastVisit: string | null;
};

// Lookup extras: loyalty balance, store credit, visit count + last visit.
export async function fetchCustomerDetail(businessId: string, customerId: string): Promise<CustomerDetail | null> {
  const { data: c } = await supabase
    .from("customers")
    .select("id, name, phone, email, notes")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!c) return null;
  const [{ data: loy }, { data: sc }, { data: orders }] = await Promise.all([
    supabase.from("loyalty_accounts").select("points").eq("business_id", businessId).eq("customer_id", customerId).maybeSingle(),
    supabase.from("store_credit_accounts").select("balance_cents").eq("business_id", businessId).eq("customer_id", customerId).maybeSingle(),
    supabase.from("orders").select("created_at").eq("business_id", businessId).eq("customer_id", customerId).neq("status", "voided").order("created_at", { ascending: false }).limit(500),
  ]);
  const rows = orders ?? [];
  return {
    id: c.id as string,
    name: (c.name as string | null) || "Guest",
    phone: (c.phone as string | null) ?? null,
    email: (c.email as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    loyaltyPoints: loy ? Number(loy.points) || 0 : null,
    storeCredit: sc ? (Number(sc.balance_cents) || 0) / 100 : 0,
    visits: rows.length,
    lastVisit: rows.length ? (rows[0].created_at as string) : null,
  };
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
