// Demo-mode shims for the v1 API writes — every mutation lands in the in-memory
// store, so a demo feels live (fire → kitchen ticket appears; bump → table turns
// Ready; seat a walk-in → they leave the waitlist) while nothing touches the
// merchant's database.
import type {
  QuoteRequest,
  QuoteResponse,
  KdsOp,
  KdsMutateResponse,
  OrdersFulfillOp,
  OrdersFulfillResponse,
  FireRequest,
  FireResponse,
  ClockOp,
  ClockResponse,
  ReservationInput,
  ReservationCreateResponse,
  ReservationMutateRequest,
  ReservationMutateResponse,
  TicketAppendRequest,
  TicketAppendResponse,
} from "@surge/api-contracts";
import type { KitchenTicket, KdsItem } from "../reads";
import { demoStore, nextId, DEMO_MENU, DEMO_TAX_RATE, round2, stationFor, type DemoCheck } from "./store";

export async function quote(body: QuoteRequest): Promise<QuoteResponse> {
  const subtotal = round2(body.items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0), 0));
  const tax = round2(subtotal * DEMO_TAX_RATE);
  return { subtotal, tax, total: round2(subtotal + tax), taxBreakdown: [{ label: "HST", rate: DEMO_TAX_RATE, base: subtotal, amount: tax }] };
}

export async function fire(staffName: string | null, body: FireRequest): Promise<FireResponse> {
  const s = demoStore();
  const now = new Date().toISOString();
  let check = body.ticketId ? s.checks.find((c) => c.id === body.ticketId) : undefined;
  if (!check && body.elementId) check = s.checks.find((c) => c.elementId === body.elementId);
  if (!check) {
    check = {
      id: nextId("chk"),
      number: s.nextCheck++,
      label: body.label || (body.channel === "takeout" ? "Takeout" : body.channel === "delivery" ? "Delivery" : body.channel === "pickup" ? "Pickup" : "Check"),
      ticketType: body.ticketType ?? (body.elementId ? "table" : "togo"),
      channel: body.channel ?? "dine_in",
      guests: body.guestCount ?? 0,
      openedAt: now,
      checkDropped: false,
      customerPhone: null,
      staffId: "demo-staff-me",
      serverName: staffName ? staffName.split(" ")[0] : "You",
      elementId: body.elementId ?? null,
      lines: [],
    } satisfies DemoCheck;
    s.checks.push(check);
  }
  // Append the fired lines to the check + split them into station tickets.
  const byStation = new Map<string, KdsItem[]>();
  let fired = 0;
  for (const it of body.items) {
    fired += it.quantity;
    check.lines.push({ catalogItemId: it.catalog_item_id, name: it.name, unitPrice: it.unit_price, quantity: it.quantity, note: it.note ?? null, seat: it.seat ?? null, firedAt: now });
    const menu = DEMO_MENU.find((m) => m.id === it.catalog_item_id);
    const station = (menu ? stationFor(menu) : null) ?? "demo-st-grill";
    if (station === "demo-st-bar") continue; // bar drinks don't hit the kitchen pass
    const arr = byStation.get(station) ?? [];
    arr.push({ name: it.name, quantity: it.quantity, note: it.note ?? null, allergens: it.allergy ? it.allergy.split(",").map((a) => a.trim()).filter(Boolean) : [] });
    byStation.set(station, arr);
  }
  for (const [station, items] of byStation) {
    const t: KitchenTicket = { id: nextId("kt"), label: check.label, items, firedAt: now, fulfilledAt: null, stationId: station, courseId: null, rush: false, elementId: check.elementId };
    s.kitchen.push(t);
  }
  return { ticketId: check.id, fired };
}

export async function kdsMutate(ticketId: string, op: KdsOp): Promise<KdsMutateResponse> {
  const t = demoStore().kitchen.find((k) => k.id === ticketId);
  if (t) t.fulfilledAt = op === "bump" ? new Date().toISOString() : null;
  return { ok: true };
}

export async function ordersFulfill(orderId: string, op: OrdersFulfillOp): Promise<OrdersFulfillResponse> {
  const o = demoStore().orders.find((x) => x.id === orderId);
  if (o) o.fulfilledAt = op === "ready" ? new Date().toISOString() : null;
  return { ok: true };
}

export async function clockToggle(staffName: string | null, op: ClockOp): Promise<ClockResponse> {
  const s = demoStore();
  const now = new Date().toISOString();
  const name = staffName ?? "You";
  if (op === "toggle") {
    if (s.myShift.onShift) {
      s.myShift = { onShift: false, onBreak: false, since: null, onBreakSince: null };
      return { ...s.myShift, action: "out", name };
    }
    s.myShift = { onShift: true, onBreak: false, since: now, onBreakSince: null };
    return { ...s.myShift, action: "in", name };
  }
  if (!s.myShift.onShift) return { ...s.myShift, action: "break_end", name };
  s.myShift = { ...s.myShift, onBreak: !s.myShift.onBreak, onBreakSince: s.myShift.onBreak ? null : now };
  return { ...s.myShift, action: s.myShift.onBreak ? "break_start" : "break_end", name };
}

export async function createReservation(body: ReservationInput): Promise<ReservationCreateResponse> {
  const s = demoStore();
  const row = {
    id: nextId("res"),
    guestName: body.guestName,
    partySize: body.partySize,
    phone: body.phone ?? null,
    email: body.email ?? null,
    scheduledAt: body.scheduledAt || null,
    quotedWaitMin: body.quotedWaitMin ?? null,
    elementId: null,
    status: body.scheduledAt ? "booked" : "waitlisted",
    notes: body.notes ?? null,
    pagedAt: null,
    createdAt: new Date().toISOString(),
  };
  s.reservations.push(row);
  const { createdAt: _c, ...contract } = row;
  return { reservation: contract, warning: null };
}

export async function reservationMutate(id: string, body: ReservationMutateRequest): Promise<ReservationMutateResponse> {
  const r = demoStore().reservations.find((x) => x.id === id);
  if (!r) return { ok: true };
  if (body.op === "page") {
    r.pagedAt = new Date().toISOString();
    return { ok: true, channel: r.phone ? "sms" : "email" };
  }
  r.status = body.status;
  return { ok: true };
}

export async function appendToTicket(staffName: string | null, body: TicketAppendRequest): Promise<TicketAppendResponse> {
  const s = demoStore();
  let check = s.checks.find((c) => c.elementId === body.elementId);
  if (!check) {
    check = {
      id: nextId("chk"),
      number: s.nextCheck++,
      label: body.label || "Table",
      ticketType: "table",
      channel: "dine_in",
      guests: 0,
      openedAt: new Date().toISOString(),
      checkDropped: false,
      customerPhone: null,
      staffId: "demo-staff-me",
      serverName: staffName ? staffName.split(" ")[0] : "You",
      elementId: body.elementId,
      lines: [],
    };
    s.checks.push(check);
  }
  check.lines.push({ catalogItemId: body.item.catalog_item_id, name: body.item.name, unitPrice: body.item.unit_price, quantity: body.item.quantity, note: body.item.note ?? null, seat: body.item.seat ?? null, firedAt: null });
  return { ticketId: check.id };
}
