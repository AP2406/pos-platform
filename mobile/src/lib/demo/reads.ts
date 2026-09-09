// Demo-mode implementations of every read in ../reads — same signatures, same
// shapes, sourced from the in-memory demo store instead of Supabase. The floor
// LAYOUT (plans/elements/sections) is deliberately not here: the demo runs on
// the merchant's real room and only synthesizes what's live on it.
import { supabase } from "../supabase";
import type {
  MenuItem,
  MoveTarget,
  Course,
  UpsellPrompt,
  OpenCheck,
  CheckLine,
  CheckHeader,
  TableSummary,
  Aging,
  OrderHubRow,
  SaleRow,
  SaleDetail,
  KitchenTicket,
  KitchenStation,
  MyShift,
  OnShiftRow,
  ReservationRow,
  CustomerRow,
  CustomerDetail,
  CustomerOrder,
  LedgerEntry,
} from "../reads";
import { demoStore, assignTables, DEMO_MENU, DEMO_STATIONS, DEMO_CUSTOMERS, checkSubtotal, checkItemCount, round2, type DemoCheck, type DemoOrder } from "./store";

// The merchant's real tables (id + label, in floor order), cached per business.
let tableCache: { bizId: string; tables: { id: string; label: string }[] } | null = null;
async function realTables(businessId: string): Promise<{ id: string; label: string }[]> {
  if (tableCache && tableCache.bizId === businessId) return tableCache.tables;
  const { data } = await supabase
    .from("floor_elements")
    .select("id, label, sort_order, plan_id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .in("kind", ["table", "booth"])
    .order("sort_order", { ascending: true });
  const tables = (data ?? []).map((e) => ({ id: e.id as string, label: (e.label as string) || "Table" }));
  tableCache = { bizId: businessId, tables };
  return tables;
}
async function ensureTables(businessId: string) {
  const tables = await realTables(businessId);
  assignTables(tables);
  return tables;
}

const first = (n: string) => n.split(" ")[0];

// ── menu ────────────────────────────────────────────────────────────────────
export async function fetchMenu(): Promise<MenuItem[]> {
  return DEMO_MENU;
}
export async function fetchCourses(): Promise<Course[]> {
  return [];
}
export async function fetchUpsells(): Promise<UpsellPrompt[]> {
  const burger = DEMO_MENU.find((m) => m.name === "Classic Burger")!;
  const fries = DEMO_MENU.find((m) => m.name === "Truffle Parmesan Fries")!;
  const ipa = DEMO_MENU.find((m) => m.name === "Local IPA")!;
  return [
    { triggerScope: "item", triggerItemId: burger.id, triggerCategory: null, suggestItemId: fries.id, label: "Upgrade to truffle fries?", comboDiscount: 1.5 },
    { triggerScope: "category", triggerItemId: null, triggerCategory: "Burgers & Sandwiches", suggestItemId: ipa.id, label: "Add a Local IPA?", comboDiscount: 1 },
  ];
}

// ── floor live layer ────────────────────────────────────────────────────────
function toOpenCheck(c: DemoCheck): OpenCheck {
  return {
    id: c.id,
    label: c.label,
    ticketType: c.ticketType,
    channel: c.channel,
    guests: c.guests,
    openedAt: c.openedAt,
    checkDropped: c.checkDropped,
    customerPhone: c.customerPhone,
    staffId: c.staffId,
    elementId: c.elementId,
    subtotal: checkSubtotal(c),
    itemCount: checkItemCount(c),
    serverName: c.serverName,
  };
}
export async function fetchOpenChecks(businessId: string): Promise<OpenCheck[]> {
  await ensureTables(businessId);
  return demoStore()
    .checks.map(toOpenCheck)
    .sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime());
}
export async function fetchTableSummaries(businessId: string): Promise<Record<string, TableSummary>> {
  await ensureTables(businessId);
  const out: Record<string, TableSummary> = {};
  for (const c of demoStore().checks) {
    if (!c.elementId) continue;
    out[c.elementId] = {
      elementId: c.elementId,
      ticketId: c.id,
      openedAt: c.openedAt,
      guests: c.guests,
      subtotal: checkSubtotal(c),
      itemCount: checkItemCount(c),
      checkDropped: c.checkDropped,
      staffId: c.staffId,
      serverName: c.serverName,
    };
  }
  return out;
}
export async function fetchTableAging(): Promise<Aging> {
  return { yellowMin: 45, redMin: 75 };
}
export async function fetchTables(businessId: string, excludeElementId?: string | null): Promise<MoveTarget[]> {
  const tables = await ensureTables(businessId);
  const occupied = new Set(demoStore().checks.map((c) => c.elementId).filter((x): x is string => !!x));
  return tables.filter((t) => t.id !== excludeElementId).map((t) => ({ elementId: t.id, label: t.label, occupied: occupied.has(t.id) }));
}
export async function fetchCheckCart(ticketId: string): Promise<CheckLine[]> {
  const c = demoStore().checks.find((x) => x.id === ticketId);
  return (c?.lines ?? []).map((l) => ({ catalogItemId: l.catalogItemId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, note: l.note, seat: l.seat }));
}
export async function fetchCheckHeader(ticketId: string): Promise<CheckHeader | null> {
  const c = demoStore().checks.find((x) => x.id === ticketId);
  if (!c) return null;
  const fired = c.lines.map((l) => l.firedAt).filter((x): x is string => !!x).sort();
  return { id: c.id, label: c.label, guests: c.guests, openedAt: c.openedAt, elementId: c.elementId, serverName: c.serverName, channel: c.channel, number: c.number, lastFiredAt: fired.length ? fired[fired.length - 1] : null };
}

// ── kitchen ─────────────────────────────────────────────────────────────────
export async function fetchKitchenTickets(businessId: string): Promise<KitchenTicket[]> {
  await ensureTables(businessId);
  const cutoff = Date.now() - 30 * 60000;
  return demoStore()
    .kitchen.filter((t) => !t.fulfilledAt || new Date(t.fulfilledAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.firedAt).getTime() - new Date(b.firedAt).getTime());
}
export async function fetchKitchenStations(): Promise<KitchenStation[]> {
  return DEMO_STATIONS;
}
export async function fetchKdsAging(): Promise<Aging> {
  return { yellowMin: 10, redMin: 18 };
}

// ── orders / sales ──────────────────────────────────────────────────────────
const customerName = (id: string | null) => (id ? DEMO_CUSTOMERS.find((c) => c.id === id)?.name ?? null : null);
const statusOf = (o: DemoOrder): SaleRow["status"] => (o.status === "voided" ? "voided" : o.refunded > 0 ? "refunded" : "paid");

export async function fetchOrdersHub(): Promise<OrderHubRow[]> {
  const since = new Date(new Date().toDateString()).getTime();
  return demoStore()
    .orders.filter((o) => new Date(o.createdAt).getTime() >= since)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => ({
      id: o.id,
      saleNumber: o.saleNumber,
      channel: o.channel,
      diningOption: o.diningOption,
      createdAt: o.createdAt,
      fulfilledAt: o.fulfilledAt,
      total: o.total,
      customerName: customerName(o.customerId),
      cancelled: o.status === "voided",
      itemCount: o.lines.reduce((n, l) => n + l.quantity, 0),
      itemSummary: o.lines.slice(0, 3).map((l) => l.quantity + "× " + l.name).join(" · ") + (o.lines.length > 3 ? " · +" + (o.lines.length - 3) + " more" : ""),
    }));
}
export async function fetchSalesHistory(_businessId: string, sinceIso: string): Promise<SaleRow[]> {
  const since = new Date(sinceIso).getTime();
  return demoStore()
    .orders.filter((o) => new Date(o.createdAt).getTime() >= since)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 500)
    .map((o) => ({
      id: o.id,
      saleNumber: o.saleNumber,
      createdAt: o.createdAt,
      total: o.total,
      subtotal: o.subtotal,
      tip: o.tip,
      method: o.method,
      status: statusOf(o),
      customerName: customerName(o.customerId),
      serverName: o.serverName,
      lines: o.lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
    }));
}
export async function fetchOrderDetail(_businessId: string, orderId: string): Promise<SaleDetail | null> {
  const o = demoStore().orders.find((x) => x.id === orderId);
  if (!o) return null;
  return {
    id: o.id,
    saleNumber: o.saleNumber,
    createdAt: o.createdAt,
    seatedAt: o.seatedAt,
    fulfilledAt: o.fulfilledAt,
    status: statusOf(o),
    fulfilled: o.fulfilledAt != null,
    channel: o.channel,
    diningOption: o.diningOption,
    guests: o.guests,
    customerName: customerName(o.customerId),
    serverName: o.serverName,
    subtotal: o.subtotal,
    discount: o.discount,
    comp: 0,
    serviceCharge: 0,
    tax: o.tax,
    tip: o.tip,
    total: o.total,
    items: o.lines.map((l) => ({ ...l, voided: false })),
    payments: o.status === "voided" ? [] : [{ method: o.method, amount: o.total }],
    refunds: o.refunded > 0 ? [{ amount: o.refunded, reasonCode: "guest_request" }] : [],
  };
}

// ── time clock ──────────────────────────────────────────────────────────────
export async function fetchMyShift(): Promise<MyShift> {
  return demoStore().myShift;
}
export async function fetchOnShift(): Promise<OnShiftRow[]> {
  return [...demoStore().shifts].sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());
}

// ── reservations + waitlist ─────────────────────────────────────────────────
export async function fetchReservations(): Promise<ReservationRow[]> {
  return demoStore()
    .reservations.filter((r) => ["booked", "waitlisted", "seated"].includes(r.status))
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

// ── customers ───────────────────────────────────────────────────────────────
export async function fetchCustomers(_businessId: string, term: string): Promise<CustomerRow[]> {
  const t = term.trim().toLowerCase();
  return DEMO_CUSTOMERS.filter((c) => !t || c.name.toLowerCase().includes(t) || (c.phone ?? "").replace(/\D/g, "").includes(t.replace(/\D/g, "") || "§") || (c.email ?? "").toLowerCase().includes(t))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email }));
}
export async function fetchCustomerDetail(_businessId: string, customerId: string): Promise<CustomerDetail | null> {
  const c = DEMO_CUSTOMERS.find((x) => x.id === customerId);
  if (!c) return null;
  const orders = demoStore().orders.filter((o) => o.customerId === c.id && o.status !== "voided");
  const lifetime = round2(orders.reduce((s, o) => s + o.total, 0));
  const last = orders.map((o) => o.createdAt).sort().pop() ?? null;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    taxExempt: c.taxExempt,
    loyaltyPoints: c.loyaltyPoints,
    storeCredit: c.storeCredit,
    houseAccount: c.name === "Ana Castillo" ? { enabled: true, balance: 412.6, limit: 2000 } : null,
    visits: orders.length,
    lifetimeSpend: lifetime,
    lastVisit: last,
  };
}
export async function fetchCustomerOrders(_businessId: string, customerId: string): Promise<CustomerOrder[]> {
  return demoStore()
    .orders.filter((o) => o.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
    .map((o) => ({ id: o.id, saleNumber: o.saleNumber, createdAt: o.createdAt, total: o.total, status: statusOf(o) }));
}
export async function fetchCustomerLedger(_businessId: string, customerId: string): Promise<LedgerEntry[]> {
  const c = DEMO_CUSTOMERS.find((x) => x.id === customerId);
  if (!c) return [];
  const orders = demoStore()
    .orders.filter((o) => o.customerId === customerId && o.status !== "voided")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const out: LedgerEntry[] = orders.slice(0, 12).map((o) => ({ source: "loyalty", kind: "earn", amount: Math.round(o.total), unit: "pts", createdAt: o.createdAt, orderId: o.id, note: null }));
  if (c.storeCredit > 0) out.push({ source: "credit", kind: "issue", amount: c.storeCredit, unit: "$", createdAt: orders[0]?.createdAt ?? new Date().toISOString(), orderId: null, note: "Goodwill credit" });
  return out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Server first names for display helpers elsewhere.
export { first as demoFirstName };
