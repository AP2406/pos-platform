"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder, searchCustomers, quickCreateCustomer } from "./actions";
import { verifyManagerPin } from "./approval-actions";
import {
  holdTicket,
  listOpenTickets,
  resumeTicket,
  discardTicket,
  updateTableTicket,
  closeTableTicket,
  sendTableTicket,
  setTicketServer,
  type OpenTicketSummary,
  type TableCart,
} from "./ticket-actions";
import { markOrderFulfilled } from "../kitchen/actions";
import { setCatalogItemOutOfStock } from "../catalog/actions";
import { DISCOUNT_REASONS, TAX_EXEMPT_REASONS } from "./reason-codes";
import { setActiveStaff, clearActiveStaff, type ActiveStaff } from "./staff-session";
import { CardPaymentModal } from "./card-payment-modal";
import { getCardConfig } from "./finix-pos-actions";
import { TenderSheet } from "./tender-sheet";
import { getPrinterConfig, printReceiptHtml } from "./qz-print";
import { buildReceiptHtml, type ReceiptSettings } from "./receipt-template";
import { RegisterRefund } from "./register-refund";
import Link from "next/link";
import { tileClassesFor } from "./category-colors";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; out_of_stock: boolean; variations: Variation[]; modifiers: Variation[] };
type CartLine = {
  catalog_item_id: string | null;
  variation_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  taxable: boolean;
  taxFrac: number;
  // How many of this line have already been fired to the kitchen (table mode).
  sent_qty?: number;
  // Optional kitchen note ("no onions", "well done").
  note?: string | null;
  // Seat this line belongs to (1-based); null = shared.
  seat?: number | null;
};
// Binding when the register is opened for a specific full-service table or to-go.
type TableBinding = { tableId: string; ticketId: string; tableLabel: string; serverName?: string | null; seatCount?: number | null };
type StaffMember = { id: string; name: string };
type Customer = { id: string; name: string; taxExempt?: boolean };
type Tender = { method: "cash" | "card" | "other"; amount: number; tendered: number | null; change: number | null };
type PaymentLine = { method: string; amount: number; tendered: number | null; change: number | null };
type Receipt = {
  id: string;
  saleNumber: number;
  businessName: string;
  customerName: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: string;
  payments: PaymentLine[];
  at: string;
  diningOption?: string | null;
  bill?: boolean;
};
type CardCfg =
  | { enabled: true; applicationId: string; environment: string; merchantId: string }
  | { enabled: false; reason: string };
type CardModalState = {
  amount: number;
  order: {
    items: CartLine[];
    tip?: number;
    discount_type: "amount" | "percent";
    discount_value: number;
    discount_reason_code?: string;
    discount_reason_note?: string;
    tax_exempt?: boolean;
    tax_exempt_reason_code?: string;
    tax_exempt_reason_note?: string;
    customer_id: string | null;
    idempotency_key: string;
    dining_option?: "dine_in" | "takeout" | "delivery" | "pickup";
  };
  receipt: {
    items: CartLine[];
    subtotal: number;
    discount: number;
    tax: number;
    tip: number;
    total: number;
    customerName: string | null;
  };
  defaultName: string;
};
type Snap = {
  items: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  customerName: string | null;
};

function methodLabel(m: string): string {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "split") return "Split";
  return "Other";
}

function printReceipt(r: Receipt, settings: Partial<ReceiptSettings> | null, widthMm: number) {
  printReceiptHtml(buildReceiptHtml(r, settings, widthMm));
}

// Rebuild register cart lines from a stored table cart, reconstructing
// taxable/taxFrac from the catalog (those aren't persisted) — same approach as
// resuming a held ticket.
function hydrateTableLines(stored: TableCart | null | undefined, items: Item[], taxRate: number): CartLine[] {
  if (!stored || !Array.isArray(stored.items)) return [];
  const taxableById: Record<string, boolean> = {};
  const fracById: Record<string, number> = {};
  for (const it of items) {
    taxableById[it.id] = it.taxable;
    fracById[it.id] = it.taxFrac;
  }
  return stored.items.map((it) => {
    const cid = it.catalog_item_id ?? null;
    return {
      catalog_item_id: cid,
      variation_id: it.variation_id ?? null,
      name: it.name,
      unit_price: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 1,
      taxable: cid ? (taxableById[cid] ?? true) : true,
      taxFrac: cid ? (fracById[cid] ?? taxRate) : taxRate,
      sent_qty: Number(it.sent_qty) || 0,
      note: it.note ?? null,
      seat: it.seat ?? null,
    };
  });
}

export function RegisterClient({ items, taxRate, businessName, hasStaff, activeStaff, receiptSettings, showItemPhotos, categoryColors, tableBinding, initialTableCart, onExitToFloor, staffList }: { items: Item[]; taxRate: number; businessName: string; hasStaff: boolean; activeStaff: ActiveStaff | null; receiptSettings: Partial<ReceiptSettings> | null; showItemPhotos: boolean; categoryColors: Record<string, string>; tableBinding?: TableBinding; initialTableCart?: TableCart | null; onExitToFloor?: () => void; staffList?: StaffMember[] }) {
  const [cart, setCart] = useState<CartLine[]>(() => hydrateTableLines(initialTableCart, items, taxRate));
  const [tip, setTip] = useState(initialTableCart?.tip ?? "");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">(initialTableCart?.discount_mode === "percent" ? "percent" : "amount");
  const [discountValue, setDiscountValue] = useState(initialTableCart?.discount_value ?? "");
  const [discountReason, setDiscountReason] = useState(initialTableCart?.discount_reason ?? "");
  const [discountReasonNote, setDiscountReasonNote] = useState(initialTableCart?.discount_reason_note ?? "");
  const [taxExempt, setTaxExempt] = useState(false);
  const [taxExemptReason, setTaxExemptReason] = useState("");
  const [taxExemptNote, setTaxExemptNote] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(initialTableCart?.customer ? { id: initialTableCart.customer.id, name: initialTableCart.customer.name } : null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null; tax_exempt: boolean }[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [pickerItem, setPickerItem] = useState<Item | null>(null);
  const [pickerVariationId, setPickerVariationId] = useState<string | null>(null);
  const [pickerMods, setPickerMods] = useState<string[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicketSummary[]>([]);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const idemKeyRef = useRef<string | null>(null);
  // Set once a table is paid out / closed, so autosave stops touching the row.
  const tableClosedRef = useRef(false);
  const [staff, setStaff] = useState<ActiveStaff | null>(activeStaff);
  const [staffPinOpen, setStaffPinOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);
  const [cardCfg, setCardCfg] = useState<CardCfg | null>(null);
  const [cardModal, setCardModal] = useState<CardModalState | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrPin, setMgrPin] = useState("");
  const [mgrErr, setMgrErr] = useState<string | null>(null);
  const [mgrBusy, setMgrBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  // Which compact cart action sheet is open, and which cart line is being edited.
  const [sheet, setSheet] = useState<null | "discount" | "tip" | "tax" | "customer">(null);
  const [editLineIndex, setEditLineIndex] = useState<number | null>(null);
  const [diningOption, setDiningOption] = useState<"dine_in" | "takeout" | "delivery" | "pickup">("dine_in");
  // Custom (open) item entry.
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  // Local 86 overrides so a long-press toggle reflects instantly.
  const [localOos, setLocalOos] = useState<Record<string, boolean>>({});
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  // Server assigned to this table/to-go ticket (change-server).
  const [serverName, setServerName] = useState<string | null>(tableBinding?.serverName ?? null);
  const [serverSheet, setServerSheet] = useState(false);
  // Seat-level ordering: a real table (not takeout) splits its order by seat.
  const tableMode = !!(tableBinding && tableBinding.tableId);
  const [seatCount, setSeatCount] = useState<number>(() => {
    if (!tableMode) return 0;
    let m = tableBinding?.seatCount || 0;
    for (const it of initialTableCart?.items ?? []) m = Math.max(m, Number(it.seat) || 0);
    return Math.max(m, 4);
  });
  const [activeSeat, setActiveSeat] = useState<number | null>(tableMode ? 1 : null);

  const itemTaxableById: Record<string, boolean> = {};
  const itemTaxFracById: Record<string, number> = {};
  for (const it of items) {
    itemTaxableById[it.id] = it.taxable;
    itemTaxFracById[it.id] = it.taxFrac;
  }

  const categories = Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c)));
  const visibleItems = items.filter((i) => {
    if (activeCat !== "All" && (i.category || "") !== activeCat) return false;
    const t = search.trim().toLowerCase();
    if (t && !i.name.toLowerCase().includes(t)) return false;
    return true;
  });

  useEffect(() => {
    if (customer) return;
    const term = customerQuery.trim();
    if (!term) {
      setCustomerResults([]);
      return;
    }
    let active = true;
    setSearchingCustomers(true);
    const t = setTimeout(async () => {
      const res = await searchCustomers(term);
      if (active) {
        setCustomerResults(res);
        setSearchingCustomers(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [customerQuery, customer]);

  useEffect(() => {
    let active = true;
    listOpenTickets().then((t) => {
      if (active) setOpenTickets(t);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getCardConfig().then((c) => {
      if (active) setCardCfg(c);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refreshTickets() {
    const t = await listOpenTickets();
    setOpenTickets(t);
  }

  function addLine(line: { catalog_item_id: string | null; variation_id: string | null; name: string; unit_price: number; taxable: boolean; taxFrac: number }) {
    setReceipt(null);
    const seat = tableMode ? activeSeat : null;
    setCart((prev) => {
      const match = (l: CartLine) =>
        l.catalog_item_id === line.catalog_item_id &&
        l.variation_id === line.variation_id &&
        l.name === line.name &&
        (l.seat ?? null) === (seat ?? null);
      if (prev.some(match)) {
        return prev.map((l) => (match(l) ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          catalog_item_id: line.catalog_item_id,
          variation_id: line.variation_id,
          name: line.name,
          unit_price: line.unit_price,
          quantity: 1,
          taxable: line.taxable,
          taxFrac: line.taxFrac,
          seat: seat,
        },
      ];
    });
  }

  function addItem(item: Item) {
    if (item.variations.length > 0 || item.modifiers.length > 0) {
      setReceipt(null);
      setPickerVariationId(null);
      setPickerMods([]);
      setPickerItem(item);
      return;
    }
    addLine({ catalog_item_id: item.id, variation_id: null, name: item.name, unit_price: item.price, taxable: item.taxable, taxFrac: item.taxFrac });
  }

  function isOos(item: Item): boolean {
    return localOos[item.id] ?? item.out_of_stock;
  }

  function toggleOos(item: Item) {
    const next = !isOos(item);
    setLocalOos((p) => ({ ...p, [item.id]: next }));
    startTransition(async () => {
      await setCatalogItemOutOfStock(item.id, next);
    });
  }

  // Long-press a tile to 86 / restock it on the fly; a normal tap adds it.
  function tileDown(item: Item) {
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      toggleOos(item);
    }, 550);
  }
  function tileUp() {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  }
  function tileClick(item: Item) {
    if (lpFired.current) {
      lpFired.current = false;
      return;
    }
    if (isOos(item)) return;
    addItem(item);
  }

  function togglePickerMod(id: string) {
    setPickerMods((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function pickerUnitPrice(item: Item): number {
    let unit = item.price;
    if (item.variations.length > 0) {
      const v = item.variations.find((x) => x.id === pickerVariationId);
      if (v) unit = v.price;
    }
    for (const m of item.modifiers) {
      if (pickerMods.includes(m.id)) unit = unit + m.price;
    }
    return Math.round(unit * 100) / 100;
  }

  function confirmOptions() {
    const item = pickerItem;
    if (!item) return;
    let varId: string | null = null;
    let label = item.name;
    let unit = item.price;
    if (item.variations.length > 0) {
      const v = item.variations.find((x) => x.id === pickerVariationId);
      if (!v) return;
      varId = v.id;
      unit = v.price;
      label = item.name + " - " + v.name;
    }
    const chosen = item.modifiers.filter((m) => pickerMods.includes(m.id));
    if (chosen.length > 0) {
      unit = unit + chosen.reduce((s, m) => s + m.price, 0);
      label = label + " (" + chosen.map((m) => "+ " + m.name).join(", ") + ")";
    }
    unit = Math.round(unit * 100) / 100;
    addLine({
      catalog_item_id: item.id,
      variation_id: varId,
      name: label,
      unit_price: unit,
      taxable: item.taxable,
      taxFrac: item.taxFrac,
    });
    setPickerItem(null);
  }

  function changeQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l, i) => (i === index ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  // Remove a single cart line outright (used by the tap-to-edit line sheet).
  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setEditLineIndex(null);
  }

  function setLineNote(index: number, note: string) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, note: note } : l)));
  }

  // Move a line to a different seat (null = shared).
  function setLineSeat(index: number, seat: number | null) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, seat: seat } : l)));
  }

  // One cart line row (reused by the flat and seat-grouped layouts).
  function renderLine(line: CartLine, index: number) {
    return (
      <div key={index} className="flex items-center gap-2">
        <button type="button" onClick={() => setEditLineIndex(index)} className="min-w-0 flex-1 text-left">
          <div className="text-sm font-medium truncate">{line.name}</div>
          <div className="text-xs text-muted-foreground">
            {"$" + line.unit_price.toFixed(2) + " each" + (line.taxable ? "" : "  " + "·" + "  Tax-free") + (line.note ? "  " + "·" + "  " + line.note : "")}
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => changeQty(index, -1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">-</button>
          <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
          <button type="button" onClick={() => changeQty(index, 1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">+</button>
        </div>
        <div className="w-16 text-right text-sm font-semibold tabular-nums shrink-0">{"$" + (line.unit_price * line.quantity).toFixed(2)}</div>
      </div>
    );
  }

  // Add an open/custom item (ad-hoc name + price, no catalog item).
  function addCustomItem() {
    const name = customName.trim();
    if (!name) return;
    const price = Math.round((parseFloat(customPrice) || 0) * 100) / 100;
    addLine({ catalog_item_id: null, variation_id: null, name: name, unit_price: price, taxable: true, taxFrac: taxRate });
    setCustomName("");
    setCustomPrice("");
    setCustomOpen(false);
  }

  // Print the current unpaid cart as a bill (pre-receipt) — no order created.
  function printBill() {
    if (cart.length === 0) return;
    const rec: Receipt = {
      id: "bill",
      saleNumber: 0,
      businessName,
      customerName: customer ? customer.name : null,
      items: cart,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      tip: tipNum,
      total: total,
      paymentMethod: "",
      payments: [],
      at: new Date().toLocaleString(),
      diningOption: diningOption,
      bill: true,
    };
    doPrint(rec);
  }

  // Serialize the current sale into the stored table-cart shape (preserves
  // per-line sent_qty so the kitchen "Send" only fires new items).
  function buildTablePayload(): TableCart {
    return {
      items: cart.map((l) => ({
        catalog_item_id: l.catalog_item_id,
        variation_id: l.variation_id,
        name: l.name,
        unit_price: l.unit_price,
        quantity: l.quantity,
        sent_qty: l.sent_qty ?? 0,
        note: l.note ?? null,
        seat: l.seat ?? null,
      })),
      tip: tip,
      discount_mode: discountMode,
      discount_value: discountValue,
      discount_reason: discountReason,
      discount_reason_note: discountReasonNote,
      customer: customer ? { id: customer.id, name: customer.name } : null,
    };
  }

  // Autosave the table ticket (table mode only), debounced. Calls the server
  // action — never setState — so it doesn't cascade renders.
  useEffect(() => {
    if (!tableBinding || tableClosedRef.current) return;
    const handle = setTimeout(() => {
      updateTableTicket(tableBinding.ticketId, buildTablePayload());
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableBinding, cart, tip, discountMode, discountValue, discountReason, discountReasonNote, customer]);

  // Count of items not yet fired to the kitchen (table mode).
  const unsentCount = cart.reduce(
    (s, l) => s + Math.max(0, l.quantity - (l.sent_qty ?? 0)),
    0
  );
  const [sending, setSending] = useState(false);

  // Fire the new items to the kitchen, then mark them sent locally.
  function sendToKitchen() {
    if (!tableBinding || unsentCount === 0) return;
    setError(null);
    setSending(true);
    startTransition(async () => {
      const res = await sendTableTicket(tableBinding.ticketId, buildTablePayload(), diningOption);
      setSending(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setCart((prev) => prev.map((l) => ({ ...l, sent_qty: l.quantity })));
    });
  }

  function changeServer(member: StaffMember) {
    if (!tableBinding) return;
    setServerName(member.name);
    setServerSheet(false);
    startTransition(async () => {
      await setTicketServer(tableBinding.ticketId, member.id);
    });
  }

  // Fire any new items, then go straight to payment.
  function sendAndPay() {
    if (tableBinding && unsentCount > 0) sendToKitchen();
    openTender();
  }

  // Save immediately, then return to the floor (the "Tables" back control).
  function exitToFloor() {
    if (tableBinding && !tableClosedRef.current) {
      updateTableTicket(tableBinding.ticketId, buildTablePayload());
    }
    if (onExitToFloor) onExitToFloor();
  }

  // After a table is paid: drop its open ticket, clear its kitchen tickets, and
  // mark the freshly-created paid order fulfilled so it doesn't re-appear on the
  // KDS (the food was already fired during the meal).
  function closeTableAfterCharge(orderId: string) {
    if (!tableBinding) return;
    tableClosedRef.current = true;
    const ticketId = tableBinding.ticketId;
    startTransition(async () => {
      await closeTableTicket(ticketId);
      await markOrderFulfilled(orderId);
    });
  }

  function clearCart() {
    setCart([]);
    setTip("");
    setDiscountValue("");
    setDiscountReason("");
    setDiscountReasonNote("");
    setTaxExempt(false);
    setTaxExemptReason("");
    setTaxExemptNote("");
    setCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    setApproved(false);
    idemKeyRef.current = null;
  }

  function nextIdemKey(): string {
    if (!idemKeyRef.current) idemKeyRef.current = crypto.randomUUID();
    return idemKeyRef.current;
  }

  function openStaffPin() {
    setStaffError(null);
    setPinEntry("");
    setStaffPinOpen(true);
  }

  function pinPush(d: string) {
    setStaffError(null);
    setPinEntry((prev) => (prev.length >= 6 ? prev : prev + d));
  }

  function pinBackspace() {
    setPinEntry((prev) => prev.slice(0, -1));
  }

  async function submitStaffPin() {
    if (!/^[0-9]{4,6}$/.test(pinEntry)) {
      setStaffError("Enter your 4 to 6 digit PIN.");
      return;
    }
    setStaffBusy(true);
    const res = await setActiveStaff(pinEntry);
    setStaffBusy(false);
    if ("error" in res) {
      setStaffError(res.error);
      setPinEntry("");
      return;
    }
    setStaff(res.staff);
    setStaffPinOpen(false);
    setPinEntry("");
  }

  async function signOutStaff() {
    setStaffBusy(true);
    await clearActiveStaff();
    setStaffBusy(false);
    setStaff(null);
  }

  function mgrPush(d: string) {
    setMgrErr(null);
    setMgrPin((prev) => (prev.length >= 6 ? prev : prev + d));
  }

  function mgrBackspace() {
    setMgrPin((prev) => prev.slice(0, -1));
  }

  async function submitMgrPin() {
    if (!/^[0-9]{4,6}$/.test(mgrPin)) {
      setMgrErr("Enter a 4 to 6 digit PIN.");
      return;
    }
    setMgrBusy(true);
    const res = await verifyManagerPin(mgrPin);
    setMgrBusy(false);
    if ("error" in res) {
      setMgrErr(res.error);
      setMgrPin("");
      return;
    }
    setApproved(true);
    setMgrOpen(false);
    setMgrPin("");
    setTenderOpen(true);
  }

  function pickCustomer(c: { id: string; name: string; tax_exempt?: boolean }) {
    setCustomer({ id: c.id, name: c.name, taxExempt: c.tax_exempt === true });
    setCustomerQuery("");
    setCustomerResults([]);
  }

  async function handleCreateCustomer() {
    const name = customerQuery.trim();
    if (!name) return;
    setAddingCustomer(true);
    const res = await quickCreateCustomer(name);
    setAddingCustomer(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setCustomer({ id: res.id, name: res.name });
    setCustomerQuery("");
    setCustomerResults([]);
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  const discountInput = parseFloat(discountValue) || 0;
  let discount = discountMode === "percent" ? subtotal * (discountInput / 100) : discountInput;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  const taxF = subtotal > 0 ? discountedSubtotal / subtotal : 0;

  const taxBucketsPreview: Record<string, number> = {};
  for (const l of cart) {
    if (!l.taxable) continue;
    if (l.taxFrac <= 0) continue;
    const key = l.taxFrac.toFixed(6);
    taxBucketsPreview[key] = (taxBucketsPreview[key] || 0) + l.unit_price * l.quantity;
  }
  let tax = 0;
  for (const key of Object.keys(taxBucketsPreview)) {
    const frac = parseFloat(key);
    const discountedBase = Math.round(taxBucketsPreview[key] * taxF * 100) / 100;
    tax += Math.round(discountedBase * frac * 100) / 100;
  }
  tax = Math.round(tax * 100) / 100;

  const customerExempt = customer ? customer.taxExempt === true : false;
  const effectiveExempt = taxExempt || customerExempt;
  if (effectiveExempt) tax = 0;

  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((discountedSubtotal + tax + tipNum) * 100) / 100;

  const discountReasonOk =
    discount <= 0 ||
    (discountReason !== "" && (discountReason !== "other" || discountReasonNote.trim().length > 0));

  const taxExemptOk =
    !taxExempt ||
    (taxExemptReason !== "" && (taxExemptReason !== "other" || taxExemptNote.trim().length > 0));

  const cardEnabled = !!(cardCfg && cardCfg.enabled);

  const cashierRole = staff ? (staff as { role?: string }).role : null;
  const needsManagerApproval =
    hasStaff && !!staff && (discount > 0 || taxExempt) && cashierRole !== "manager";

  function snapshot(): Snap {
    return {
      items: cart,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      tip: tipNum,
      total: total,
      customerName: customer ? customer.name : null,
    };
  }

  function doPrint(r: Receipt) {
    const cfg = getPrinterConfig();
    printReceipt(r, receiptSettings, cfg ? cfg.widthMm : 54);
  }

  function finishSale(res: { id: string; sale_number: number }, pm: string, payments: PaymentLine[], snap: Snap) {
    const rec: Receipt = {
      id: res.id,
      saleNumber: res.sale_number,
      businessName,
      customerName: snap.customerName,
      items: snap.items,
      subtotal: snap.subtotal,
      discount: snap.discount,
      tax: snap.tax,
      tip: snap.tip,
      total: snap.total,
      paymentMethod: pm,
      payments: payments,
      at: new Date().toLocaleString(),
      diningOption: diningOption,
    };
    setReceipt(rec);
    setTenderOpen(false);
    clearCart();
    closeTableAfterCharge(res.id);
    const cfg = getPrinterConfig();
    if (cfg && cfg.autoPrint) doPrint(rec);
  }

  function commonOrderFields() {
    return {
      items: cart,
      tip: tipNum,
      idempotency_key: nextIdemKey(),
      discount_type: discountMode,
      discount_value: discountInput,
      discount_reason_code: discount > 0 ? discountReason : undefined,
      discount_reason_note:
        discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
      tax_exempt: taxExempt || undefined,
      tax_exempt_reason_code: taxExempt ? taxExemptReason : undefined,
      tax_exempt_reason_note:
        taxExempt && taxExemptReason === "other" ? taxExemptNote.trim() : undefined,
      customer_id: customer ? customer.id : null,
      dining_option: diningOption,
    };
  }

  function openTender() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (total <= 0) {
      setError("Total must be more than zero.");
      return;
    }
    if (discount > 0 && !discountReasonOk) {
      setError("Choose a reason for the discount.");
      return;
    }
    if (taxExempt && !taxExemptOk) {
      setError("Choose a reason for the tax exemption.");
      return;
    }
    if (needsManagerApproval && !approved) {
      setMgrErr(null);
      setMgrPin("");
      setMgrOpen(true);
      return;
    }
    setTenderOpen(true);
  }

  function recordCash(tenderedDollars: number) {
    setError(null);
    if (cart.length === 0) return;
    const snap = snapshot();
    const tendered = Math.round(tenderedDollars * 100) / 100;
    const change = Math.round((tendered - snap.total) * 100) / 100;
    startTransition(async () => {
      const res = await createOrder({
        ...commonOrderFields(),
        payments: [{ method: "cash", amount: snap.total, tendered: tendered }],
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      finishSale(res, "cash", [{ method: "cash", amount: snap.total, tendered: tendered, change: change > 0 ? change : 0 }], snap);
    });
  }

  function recordSplit(tenders: Tender[]) {
    setError(null);
    if (cart.length === 0) return;
    const snap = snapshot();
    const pm = tenders.length > 1 ? "split" : tenders[0].method;
    startTransition(async () => {
      const res = await createOrder({
        ...commonOrderFields(),
        payments: tenders.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered })),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      finishSale(res, pm, tenders, snap);
    });
  }

  function recordCardNoCharge() {
    setError(null);
    if (cart.length === 0) return;
    const snap = snapshot();
    startTransition(async () => {
      const res = await createOrder({
        ...commonOrderFields(),
        payment_method: "card",
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      finishSale(res, "card", [{ method: "card", amount: snap.total, tendered: null, change: null }], snap);
    });
  }

  function recordCardManual() {
    setError(null);
    if (cart.length === 0) return;
    setTenderOpen(false);
    setCardModal({
      amount: total,
      order: {
        items: cart,
        tip: tipNum,
        discount_type: discountMode,
        discount_value: discountInput,
        discount_reason_code: discount > 0 ? discountReason : undefined,
        discount_reason_note:
          discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
        tax_exempt: taxExempt || undefined,
        tax_exempt_reason_code: taxExempt ? taxExemptReason : undefined,
        tax_exempt_reason_note:
          taxExempt && taxExemptReason === "other" ? taxExemptNote.trim() : undefined,
        customer_id: customer ? customer.id : null,
        idempotency_key: nextIdemKey(),
        dining_option: diningOption,
      },
      receipt: {
        items: cart,
        subtotal: subtotal,
        discount: discount,
        tax: tax,
        tip: tipNum,
        total: total,
        customerName: customer ? customer.name : null,
      },
      defaultName: customer ? customer.name : "",
    });
  }

  function handleCardSuccess(res: { id: string; sale_number: number; transferId: string }) {
    const m = cardModal;
    if (!m) return;
    const rec: Receipt = {
      id: res.id,
      saleNumber: res.sale_number,
      businessName,
      customerName: m.receipt.customerName,
      items: m.receipt.items,
      subtotal: m.receipt.subtotal,
      discount: m.receipt.discount,
      tax: m.receipt.tax,
      tip: m.receipt.tip,
      total: m.receipt.total,
      paymentMethod: "card",
      payments: [{ method: "card", amount: m.receipt.total, tendered: null, change: null }],
      at: new Date().toLocaleString(),
      diningOption: diningOption,
    };
    setReceipt(rec);
    setCardModal(null);
    setTenderOpen(false);
    clearCart();
    closeTableAfterCharge(res.id);
    const cfg = getPrinterConfig();
    if (cfg && cfg.autoPrint) doPrint(rec);
  }

  function openHold() {
    setError(null);
    if (cart.length === 0) return;
    setHoldLabel("");
    setHoldOpen(true);
  }

  async function doHold() {
    setError(null);
    if (cart.length === 0) return;
    setTicketBusy(true);
    const res = await holdTicket({
      label: holdLabel.trim() ? holdLabel.trim() : null,
      cart: {
        items: cart,
        tip: tip,
        discount_mode: discountMode,
        discount_value: discountValue,
        discount_reason: discountReason,
        discount_reason_note: discountReasonNote,
        customer: customer,
      },
    });
    setTicketBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setHoldOpen(false);
    setHoldLabel("");
    clearCart();
    setReceipt(null);
    await refreshTickets();
  }

  async function doResume(id: string) {
    setError(null);
    setTicketBusy(true);
    const res = await resumeTicket(id);
    setTicketBusy(false);
    if ("error" in res) {
      setError(res.error);
      await refreshTickets();
      return;
    }
    const c = res.cart;
    const lines = Array.isArray(c.items) ? c.items : [];
    setCart(
      lines.map((it) => {
        const cid = it.catalog_item_id ?? null;
        return {
          catalog_item_id: cid,
          variation_id: it.variation_id ?? null,
          name: it.name,
          unit_price: Number(it.unit_price) || 0,
          quantity: Number(it.quantity) || 1,
          taxable: cid ? (itemTaxableById[cid] ?? true) : true,
          taxFrac: cid ? (itemTaxFracById[cid] ?? taxRate) : taxRate,
        };
      })
    );
    setTip(c.tip ?? "");
    setDiscountMode(c.discount_mode === "percent" ? "percent" : "amount");
    setDiscountValue(c.discount_value ?? "");
    setDiscountReason(c.discount_reason ?? "");
    setDiscountReasonNote(c.discount_reason_note ?? "");
    setCustomer(c.customer ? { id: c.customer.id, name: c.customer.name } : null);
    setApproved(false);
    setReceipt(null);
    setTicketsOpen(false);
    await refreshTickets();
  }

  async function doDiscard(id: string) {
    setTicketBusy(true);
    const res = await discardTicket(id);
    setTicketBusy(false);
    if ("error" in res) {
      setError(res.error);
    }
    await refreshTickets();
  }

  return (
    <>
      {staffPinOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setStaffPinOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Enter your PIN</h3>
              <button type="button" onClick={() => setStaffPinOpen(false)} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>
            <div className="mb-3 h-10 rounded-md border border-border flex items-center justify-center tracking-[0.4em] text-lg">
              {pinEntry ? pinEntry.replace(/./g, "\u2022") : <span className="text-muted-foreground tracking-normal text-sm">PIN</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} type="button" onClick={() => pinPush(d)} className="h-12 rounded-md border border-border text-lg font-medium hover:bg-accent">
                  {d}
                </button>
              ))}
              <button type="button" onClick={pinBackspace} className="h-12 rounded-md border border-border text-sm hover:bg-accent">
                Del
              </button>
              <button type="button" onClick={() => pinPush("0")} className="h-12 rounded-md border border-border text-lg font-medium hover:bg-accent">
                0
              </button>
              <button type="button" onClick={submitStaffPin} disabled={staffBusy} className="h-12 rounded-md border border-foreground bg-accent text-sm font-medium hover:bg-accent/80 disabled:opacity-50">
                {staffBusy ? "..." : "Enter"}
              </button>
            </div>
            {staffError && <p className="text-sm text-red-600 mt-2">{staffError}</p>}
          </div>
        </div>
      )}

      {mgrOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setMgrOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Manager approval</h3>
              <button type="button" onClick={() => setMgrOpen(false)} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">A discount or tax exemption needs a manager{"\u2019"}s PIN to continue.</p>
            <div className="mb-3 h-10 rounded-md border border-border flex items-center justify-center tracking-[0.4em] text-lg">
              {mgrPin ? mgrPin.replace(/./g, "\u2022") : <span className="text-muted-foreground tracking-normal text-sm">PIN</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} type="button" onClick={() => mgrPush(d)} className="h-12 rounded-md border border-border text-lg font-medium hover:bg-accent">
                  {d}
                </button>
              ))}
              <button type="button" onClick={mgrBackspace} className="h-12 rounded-md border border-border text-sm hover:bg-accent">
                Del
              </button>
              <button type="button" onClick={() => mgrPush("0")} className="h-12 rounded-md border border-border text-lg font-medium hover:bg-accent">
                0
              </button>
              <button type="button" onClick={submitMgrPin} disabled={mgrBusy} className="h-12 rounded-md border border-foreground bg-accent text-sm font-medium hover:bg-accent/80 disabled:opacity-50">
                {mgrBusy ? "..." : "Approve"}
              </button>
            </div>
            {mgrErr && <p className="text-sm text-red-600 mt-2">{mgrErr}</p>}
          </div>
        </div>
      )}

      {pickerItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setPickerItem(null)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{pickerItem.name}</h3>
              <button type="button" onClick={() => setPickerItem(null)} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>

            {pickerItem.variations.length > 0 && (
              <div className="space-y-2 mb-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Choose one</div>
                {pickerItem.variations.map((v) => {
                  const selected = pickerVariationId === v.id;
                  return (
                    <button key={v.id} type="button" onClick={() => setPickerVariationId(v.id)} className={"w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors " + (selected ? "border-foreground bg-accent" : "border-border hover:border-foreground/40 hover:bg-accent/50")}>
                      <span className="text-sm font-medium">{v.name}</span>
                      <span className="text-sm tabular-nums">{"$" + v.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {pickerItem.modifiers.length > 0 && (
              <div className="space-y-2 mb-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Add-ons</div>
                {pickerItem.modifiers.map((m) => {
                  const checked = pickerMods.includes(m.id);
                  return (
                    <button key={m.id} type="button" onClick={() => togglePickerMod(m.id)} className={"w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors " + (checked ? "border-foreground bg-accent" : "border-border hover:border-foreground/40 hover:bg-accent/50")}>
                      <span className="flex items-center gap-2">
                        <span className={"w-4 h-4 rounded border flex items-center justify-center text-[10px] " + (checked ? "bg-foreground text-background border-foreground" : "border-muted-foreground")}>{checked ? "\u2713" : ""}</span>
                        <span className="text-sm font-medium">{m.name}</span>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">{"+$" + m.price.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <Button className="w-full" onClick={confirmOptions} disabled={pickerItem.variations.length > 0 && !pickerVariationId}>
              {"Add to cart - $" + pickerUnitPrice(pickerItem).toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {holdOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setHoldOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Hold ticket</h3>
              <button type="button" onClick={() => setHoldOpen(false)} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Save this sale to resume later. The register will clear.
            </p>
            <Label className="text-xs">Label (optional)</Label>
            <Input value={holdLabel} onChange={(e) => setHoldLabel(e.target.value)} placeholder='e.g. "Table 5" or a name' className="h-9 mt-1" />
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <div className="flex gap-2 mt-3">
              <Button className="flex-1" onClick={doHold} disabled={ticketBusy}>
                {ticketBusy ? "Holding..." : "Hold ticket"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setHoldOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {ticketsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setTicketsOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Open tickets</h3>
              <button type="button" onClick={() => setTicketsOpen(false)} className="text-xs text-muted-foreground underline">
                Close
              </button>
            </div>
            {openTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tickets.</p>
            ) : (
              <div className="space-y-2">
                {openTickets.map((t) => (
                  <div key={t.id} className="rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.label ? t.label : "Ticket"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.item_count + (t.item_count === 1 ? " item" : " items") + "  " + "\u00b7" + "  " + "$" + t.subtotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button className="flex-1" onClick={() => doResume(t.id)} disabled={ticketBusy}>
                        Resume
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => doDiscard(t.id)} disabled={ticketBusy}>
                        Discard
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {cardModal && cardCfg && cardCfg.enabled && (
        <CardPaymentModal
          amount={cardModal.amount}
          order={cardModal.order}
          config={{
            applicationId: cardCfg.applicationId,
            environment: cardCfg.environment,
            merchantId: cardCfg.merchantId,
          }}
          defaultName={cardModal.defaultName}
          onClose={() => setCardModal(null)}
          onSuccess={handleCardSuccess}
        />
      )}

      <TenderSheet
        open={tenderOpen}
        onClose={() => setTenderOpen(false)}
        total={total}
        pending={pending}
        cardEnabled={cardEnabled}
        onCash={recordCash}
        onSplit={recordSplit}
        onCardManual={recordCardManual}
        onCardRecord={recordCardNoCharge}
      />

      {receipt && cart.length === 0 ? (
        <div className="h-full overflow-y-auto flex items-start justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 12l5 5L20 7" /></svg>
              </span>
              <div>
                <h2 className="font-medium leading-tight">Sale complete</h2>
                <div className="text-xs text-muted-foreground">{"Sale #" + receipt.saleNumber}</div>
              </div>
            </div>
            {receipt.customerName && <div className="text-xs text-muted-foreground">{"Customer: " + receipt.customerName}</div>}
            <div className="text-sm space-y-1">
              {receipt.items.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate">{l.name} x{l.quantity}</span>
                  <span className="tabular-nums">{"$" + (l.unit_price * l.quantity).toFixed(2)}</span>
                </div>
              ))}
              {receipt.discount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-red-600">{"-$" + receipt.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span className="tabular-nums">{"$" + receipt.total.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-border space-y-1">
                {receipt.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {methodLabel(p.method)}
                      {p.method === "cash" && p.change !== null && p.change > 0 ? " (change $" + p.change.toFixed(2) + ")" : ""}
                    </span>
                    <span className="tabular-nums">{"$" + p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => doPrint(receipt)}>
                Print receipt
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setReceipt(null); if (tableBinding && onExitToFloor) onExitToFloor(); }}>
                {tableBinding ? "Back to tables" : "New sale"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          {/* Slim dark top bar */}
          <div className="shrink-0 flex items-center justify-between gap-3 h-12 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="font-semibold truncate">{tableBinding ? tableBinding.tableLabel : businessName}</span>
              {tableBinding && (
                <span className="text-xs text-sidebar-foreground/70 truncate hidden sm:inline">{businessName}</span>
              )}
              {hasStaff && (
                <span className="text-xs text-sidebar-foreground/70 truncate hidden sm:inline">
                  {staff ? "Ringing as " + staff.name : "No cashier set"}
                </span>
              )}
              {hasStaff && (
                staff ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={openStaffPin} className="text-xs text-sidebar-foreground/70 underline hover:text-sidebar-foreground">Switch</button>
                    <button type="button" onClick={signOutStaff} disabled={staffBusy} className="text-xs text-sidebar-foreground/70 underline hover:text-sidebar-foreground">Sign out</button>
                  </span>
                ) : (
                  <button type="button" onClick={openStaffPin} className="text-xs font-medium underline shrink-0">Enter PIN</button>
                )
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tableBinding && staffList && staffList.length > 0 && (
                <button type="button" onClick={() => setServerSheet(true)} className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent">
                  {serverName ? serverName : "Assign server"}
                </button>
              )}
              <RegisterRefund businessName={businessName} />
              {!tableBinding && openTickets.length > 0 && (
                <button type="button" onClick={() => setTicketsOpen(true)} className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent">
                  Tickets
                  <span className="px-1.5 rounded-full bg-sidebar-accent tabular-nums">{openTickets.length}</span>
                </button>
              )}
              {tableBinding ? (
                <button type="button" onClick={exitToFloor} className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M15 18l-6-6 6-6" /></svg>
                  Tables
                </button>
              ) : (
                <Link href="/app" className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                  Exit
                </Link>
              )}
            </div>
          </div>

          {/* Items + cart */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row">
            <div className="flex-1 min-h-0 flex flex-col border-b md:border-b-0 md:border-r border-border">
              <div className="shrink-0 px-3 pt-3 space-y-3">
                {categories.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {["All", ...categories].map((c) => {
                      const active = activeCat === c;
                      return (
                        <button key={c} type="button" onClick={() => setActiveCat(c)} className={"shrink-0 text-sm px-3 py-1.5 rounded-full border transition-colors " + (active ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:border-foreground/40")}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className="h-10 flex-1" />
                  <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => { setCustomName(""); setCustomPrice(""); setCustomOpen(true); }}>
                    Custom
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {visibleItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No items match. Add some in the Catalog, or clear the search.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                    {visibleItems.map((item) => {
                      const hasVars = item.variations.length > 0;
                      const priceLabel = hasVars
                        ? "From $" + Math.min(...item.variations.map((v) => v.price)).toFixed(2)
                        : "$" + item.price.toFixed(2);
                      const oos = isOos(item);
                      if (showItemPhotos && item.image_url) {
                        return (
                          <button key={item.id} type="button" onClick={() => tileClick(item)} onPointerDown={() => tileDown(item)} onPointerUp={tileUp} onPointerLeave={tileUp} className={"relative min-h-[110px] rounded-lg border border-border overflow-hidden active:scale-[0.97] transition-transform " + (oos ? "opacity-50" : "")}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-left px-2 py-1.5">
                              <div className="font-semibold text-sm leading-snug line-clamp-2">{item.name}</div>
                              <div className="text-xs text-white/90">{oos ? "86'd" : priceLabel}</div>
                            </div>
                          </button>
                        );
                      }
                      return (
                        <button key={item.id} type="button" onClick={() => tileClick(item)} onPointerDown={() => tileDown(item)} onPointerUp={tileUp} onPointerLeave={tileUp} className={"text-left p-3 min-h-[110px] rounded-lg border active:scale-[0.97] transition-all flex flex-col justify-between " + tileClassesFor(item.category, categoryColors) + (oos ? " opacity-50" : "")}>
                          <div className="font-semibold text-sm leading-snug line-clamp-3">{item.name}</div>
                          <div className="text-xs opacity-80 mt-1">{oos ? "86'd" : priceLabel}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 md:flex-none md:w-[400px] flex flex-col bg-card/40">
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-medium">Current sale</h2>
                {cart.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={printBill} className="text-xs text-muted-foreground underline hover:text-foreground">Bill</button>
                    {!tableBinding && (
                      <button type="button" onClick={openHold} className="text-xs text-muted-foreground underline hover:text-foreground">Hold</button>
                    )}
                    <button type="button" onClick={clearCart} className="text-xs text-muted-foreground underline hover:text-foreground">Clear</button>
                  </div>
                )}
              </div>

              {/* Seat selector (real tables only) */}
              {tableMode && (
                <div className="shrink-0 flex items-center gap-1 px-2 py-2 border-b border-border overflow-x-auto">
                  <button type="button" onClick={() => setActiveSeat(null)} className={"shrink-0 text-xs rounded-md border px-2.5 py-1.5 " + (activeSeat === null ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>Shared</button>
                  {Array.from({ length: seatCount }, (_, i) => i + 1).map((s) => (
                    <button key={s} type="button" onClick={() => setActiveSeat(s)} className={"shrink-0 text-xs rounded-md border px-2.5 py-1.5 " + (activeSeat === s ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>{"Seat " + s}</button>
                  ))}
                  <button type="button" onClick={() => setSeatCount((n) => Math.min(n + 1, 30))} className="shrink-0 text-xs rounded-md border border-dashed border-border px-2 py-1.5 text-muted-foreground hover:bg-accent/50">+ Seat</button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tableMode ? "Pick a seat, then tap items to add to it." : "Tap items to add them to the sale."}</p>
                ) : !tableMode ? (
                  cart.map((line, index) => renderLine(line, index))
                ) : (
                  <>
                    {[...Array.from({ length: seatCount }, (_, i) => i + 1), null].map((seat) => {
                      const entries = cart.map((l, i) => ({ l, i })).filter((e) => (e.l.seat ?? null) === seat);
                      if (seat === null && entries.length === 0) return null;
                      const sub = entries.reduce((s, e) => s + e.l.unit_price * e.l.quantity, 0);
                      return (
                        <div key={seat === null ? "shared" : "s" + seat} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{seat === null ? "Shared" : "Seat " + seat}</span>
                            {entries.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{"$" + sub.toFixed(2)}</span>}
                          </div>
                          {entries.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 pl-1">No items</p>
                          ) : (
                            entries.map((e) => renderLine(e.l, e.i))
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="shrink-0 border-t border-border">
                {cart.length > 0 && (
                  <div className="flex items-center gap-1 p-2 border-b border-border">
                    {(["dine_in", "takeout", "delivery", "pickup"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setDiningOption(d)} className={"flex-1 text-xs rounded-md border px-1 py-1.5 capitalize " + (diningOption === d ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>
                        {d.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
                {tableBinding && cart.length > 0 && (
                  <div className="p-2 border-b border-border flex gap-2">
                    <Button variant="outline" className="flex-1 h-11" onClick={sendToKitchen} disabled={pending || sending || unsentCount === 0}>
                      {sending ? "Sending..." : unsentCount > 0 ? "Send " + unsentCount : "All sent"}
                    </Button>
                    <Button variant="outline" className="flex-1 h-11" onClick={sendAndPay} disabled={pending}>
                      Send &amp; Pay
                    </Button>
                  </div>
                )}
                {cart.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 p-2 border-b border-border">
                    <button type="button" onClick={() => setSheet("discount")} className={"rounded-md border px-1 py-2 text-center hover:bg-accent " + (discount > 0 ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Discount</div>
                      <div className="text-xs font-medium truncate">{discount > 0 ? "-$" + discount.toFixed(2) : "Add"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("tip")} className={"rounded-md border px-1 py-2 text-center hover:bg-accent " + (tipNum > 0 ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tip</div>
                      <div className="text-xs font-medium truncate">{tipNum > 0 ? "$" + tipNum.toFixed(2) : "Add"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("tax")} className={"rounded-md border px-1 py-2 text-center hover:bg-accent " + (effectiveExempt ? "border-emerald-600" : "border-border")}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tax</div>
                      <div className={"text-xs font-medium truncate " + (effectiveExempt ? "text-emerald-600" : "")}>{effectiveExempt ? "Exempt" : "Applied"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("customer")} className={"rounded-md border px-1 py-2 text-center hover:bg-accent " + (customer ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Customer</div>
                      <div className="text-xs font-medium truncate">{customer ? customer.name : "Add"}</div>
                    </button>
                  </div>
                )}

                <div className="p-4 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{"$" + subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600">{"-$" + discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{effectiveExempt ? "Tax (exempt)" : "Tax"}</span>
                    <span className="tabular-nums">{"$" + tax.toFixed(2)}</span>
                  </div>
                  {tipNum > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tip</span>
                      <span className="tabular-nums">{"$" + tipNum.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between pt-1">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-3xl font-bold tabular-nums leading-none">{"$" + total.toFixed(2)}</span>
                  </div>

                  {error && <p className="text-sm text-red-600 pt-1">{error}</p>}

                  <Button className="w-full h-14 text-base mt-2" onClick={openTender} disabled={pending || cart.length === 0 || (discount > 0 && !discountReasonOk) || (taxExempt && !taxExemptOk)}>
                    {"Charge" + (total > 0 ? " $" + total.toFixed(2) : "")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tap-a-line editor */}
          {editLineIndex !== null && cart[editLineIndex] && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setEditLineIndex(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium truncate pr-2">{cart[editLineIndex].name}</h3>
                  <button type="button" onClick={() => setEditLineIndex(null)} className="text-xs text-muted-foreground underline shrink-0">Done</button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => changeQty(editLineIndex, -1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">-</button>
                    <span className="w-8 text-center text-base tabular-nums">{cart[editLineIndex].quantity}</span>
                    <button type="button" onClick={() => changeQty(editLineIndex, 1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">+</button>
                  </div>
                  <span className="text-base font-semibold tabular-nums">{"$" + (cart[editLineIndex].unit_price * cart[editLineIndex].quantity).toFixed(2)}</span>
                </div>
                <div className="space-y-1 mt-3">
                  <Label className="text-xs">Kitchen note</Label>
                  <Input value={cart[editLineIndex].note ?? ""} onChange={(e) => setLineNote(editLineIndex, e.target.value)} placeholder="e.g. no onions, well done" className="h-10" />
                </div>
                {tableMode && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Seat</Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button type="button" onClick={() => setLineSeat(editLineIndex, null)} className={"text-xs rounded-md border px-2.5 py-1.5 " + ((cart[editLineIndex].seat ?? null) === null ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>Shared</button>
                      {Array.from({ length: seatCount }, (_, i) => i + 1).map((s) => (
                        <button key={s} type="button" onClick={() => setLineSeat(editLineIndex, s)} className={"text-xs rounded-md border px-2.5 py-1.5 " + (cart[editLineIndex].seat === s ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4 text-red-600" onClick={() => removeLine(editLineIndex)}>
                  Remove from sale
                </Button>
              </div>
            </div>
          )}

          {/* Change-server sheet */}
          {serverSheet && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setServerSheet(false)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Assign server</h3>
                  <button type="button" onClick={() => setServerSheet(false)} className="text-xs text-muted-foreground underline">Cancel</button>
                </div>
                <div className="space-y-1">
                  {(staffList ?? []).map((m) => (
                    <button key={m.id} type="button" onClick={() => changeServer(m)} className={"w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent " + (serverName === m.name ? "bg-accent font-medium" : "")}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Custom (open) item sheet */}
          {customOpen && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setCustomOpen(false)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Custom item</h3>
                  <button type="button" onClick={() => setCustomOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Item name" className="h-11" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price</Label>
                    <Input type="number" min="0" step="0.01" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="0.00" className="h-11 text-right" />
                  </div>
                  <Button className="w-full h-11 mt-1" onClick={addCustomItem} disabled={!customName.trim()}>
                    Add to sale
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Discount sheet */}
          {sheet === "discount" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Discount</h3>
                  <button type="button" onClick={() => setSheet(null)} className="text-xs text-muted-foreground underline">Done</button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-border overflow-hidden text-sm">
                    <button type="button" onClick={() => setDiscountMode("amount")} className={"px-3 py-2 " + (discountMode === "amount" ? "bg-accent font-medium" : "hover:bg-accent/50")}>$</button>
                    <button type="button" onClick={() => setDiscountMode("percent")} className={"px-3 py-2 border-l border-border " + (discountMode === "percent" ? "bg-accent font-medium" : "hover:bg-accent/50")}>%</button>
                  </div>
                  <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" className="flex-1 h-11 text-right" />
                </div>
                {discount > 0 && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Discount reason</Label>
                    <select value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                      <option value="">Select a reason...</option>
                      {DISCOUNT_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    {discountReason === "other" && (
                      <Input value={discountReasonNote} onChange={(e) => setDiscountReasonNote(e.target.value)} placeholder="Reason note" className="h-10" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tip sheet */}
          {sheet === "tip" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Tip</h3>
                  <button type="button" onClick={() => setSheet(null)} className="text-xs text-muted-foreground underline">Done</button>
                </div>
                <Input type="number" min="0" step="0.01" value={tip} onChange={(e) => setTip(e.target.value)} placeholder="0.00" className="h-11 text-right" />
              </div>
            </div>
          )}

          {/* Tax exempt sheet */}
          {sheet === "tax" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Tax</h3>
                  <button type="button" onClick={() => setSheet(null)} className="text-xs text-muted-foreground underline">Done</button>
                </div>
                {customerExempt ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <span className="w-4 h-4 rounded border border-emerald-600 flex items-center justify-center text-[10px]">{"\u2713"}</span>
                    Tax exempt (customer)
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="w-4 h-4" />
                      Tax exempt
                    </label>
                    {taxExempt && (
                      <div className="space-y-1">
                        <select value={taxExemptReason} onChange={(e) => setTaxExemptReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                          <option value="">Select a reason...</option>
                          {TAX_EXEMPT_REASONS.map((r) => (
                            <option key={r.code} value={r.code}>{r.label}</option>
                          ))}
                        </select>
                        {taxExemptReason === "other" && (
                          <Input value={taxExemptNote} onChange={(e) => setTaxExemptNote(e.target.value)} placeholder="Reason note" className="h-10" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer sheet */}
          {sheet === "customer" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Customer</h3>
                  <button type="button" onClick={() => setSheet(null)} className="text-xs text-muted-foreground underline">Done</button>
                </div>
                {customer ? (
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm font-medium truncate">{customer.name}</span>
                    <button type="button" onClick={() => setCustomer(null)} className="text-xs text-muted-foreground underline hover:text-foreground">Remove</button>
                  </div>
                ) : (
                  <div>
                    <Input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Search or add a customer" className="h-10" />
                    {customerQuery.trim() && (
                      <div className="mt-1 rounded-md border border-border divide-y divide-border overflow-hidden">
                        {searchingCustomers ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                        ) : customerResults.length > 0 ? (
                          customerResults.map((c) => (
                            <button key={c.id} type="button" onClick={() => pickCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                              {c.name}
                              {c.phone ? <span className="text-xs text-muted-foreground">{"  " + "\u00b7" + "  " + c.phone}</span> : null}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                        )}
                        <button type="button" onClick={handleCreateCustomer} disabled={addingCustomer} className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-accent">
                          {addingCustomer ? "Adding..." : 'Add new customer "' + customerQuery.trim() + '"'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}