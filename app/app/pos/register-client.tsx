"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { formatPaymentMethod, displayItemName } from "@/lib/format";
import { createOrder, searchCustomers, quickCreateCustomer } from "./actions";
import { finalizeSplitCheck, type SplitResultOrder } from "./split-actions";
import { SplitSheet, type SplitCheck } from "./split-sheet";
import { verifyManagerPin } from "./approval-actions";
import { requestRegisterApproval, getApprovalStatus, requestManagerCall } from "../approvals/actions";
import { listSavedTickets, saveSavedTicket, deleteSavedTicket, type SavedTicket, type SavedLine } from "./saved-ticket-actions";
import { resolveWindow, windowPrice, type PriceWindow } from "@/lib/services/price-windows";

type UpsellPrompt = { triggerScope: "item" | "category"; triggerItemId: string | null; triggerCategory: string | null; suggestItemId: string; label: string | null; comboDiscount: number };
import { ALLERGENS, allergenLabels } from "@/lib/allergens";
import {
  holdTicket,
  listOpenTickets,
  resumeTicket,
  discardTicket,
  updateTableTicket,
  closeTableTicket,
  sendTableTicket,
  fireCourse,
  sendVoidNotice,
  splitTicketIntoChildren,
  listOpenTableTargets,
  transferLineToTicket,
  listTableMoveTargets,
  moveTicketToTable,
  setTicketServer,
  dropCheck,
  type OpenTicketSummary,
  type TableCart,
} from "./ticket-actions";
import { markOrderFulfilled } from "../kitchen/actions";
import { setCatalogItemOutOfStock } from "../catalog/actions";
import { DISCOUNT_REASONS, COMP_REASONS, SERVICE_CHARGE_WAIVE_REASONS, TAX_EXEMPT_REASONS, VOID_REASONS } from "./reason-codes";
import { setActiveStaff, clearActiveStaff, type ActiveStaff } from "./staff-session";
import { CardPaymentModal } from "./card-payment-modal";
import { getCardConfig } from "./finix-pos-actions";
import { TenderSheet } from "./tender-sheet";
import { getPrinterConfig, printReceiptHtml } from "./qz-print";
import { buildReceiptHtml, type ReceiptSettings } from "./receipt-template";
import { RegisterRefund } from "./register-refund";
import { useOnlineStatus } from "./use-online";
import { getLoyaltyBalance } from "./loyalty-actions";
import { getStoreCreditBalance } from "./store-credit-actions";
import Link from "next/link";
import { tileClassesFor } from "./category-colors";

type Variation = { id: string; name: string; price: number };
type ModOption = { id: string; name: string; price: number; child_group?: ModifierGroup };
type ModifierGroup = { id: string; name: string; required: boolean; min_select: number; max_select: number | null; options: ModOption[] };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; image_url: string | null; out_of_stock: boolean; variations: Variation[]; modifiers: Variation[]; modifierGroups?: ModifierGroup[]; default_course_id?: string | null; track_inventory?: boolean; stock_qty?: number | null; reorder_point?: number | null };
type Course = { id: string; name: string; sort_order: number };
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
  // Per-line/per-seat allergy tag (P3) — shown bold red on the KDS + chit.
  allergy?: string | null;
  // Seat this line belongs to (1-based); null = shared.
  seat?: number | null;
  // E3: seats sharing this line — the by-seat split allocates it across just these.
  shared_seats?: number[] | null;
  // Coursing (P0-1): which course this line fires with, and when last fired.
  course_id?: string | null;
  fired_at?: string | null;
  // P0-10: a voided line (not made) — kept for the record, excluded from totals.
  void?: { reason_code?: string; reason_note?: string } | null;
  // P2-27: added by a guest via QR ordering.
  guest?: boolean;
};
// Binding when the register is opened for a specific full-service table or to-go.
type TableBinding = { tableId: string; ticketId: string; tableLabel: string; serverName?: string | null; seatCount?: number | null; guestCount?: number | null };
type ServiceChargeCfg = { enabled: boolean; pct: number; autoParty: number; postTax: boolean; label: string };
type SplitCfg = { settlementMode: "separate" | "informational"; allowUnits: boolean };
type StaffMember = { id: string; name: string };
type Customer = { id: string; name: string; taxExempt?: boolean };
type Tender = { method: "cash" | "card" | "other" | "gift_card" | "store_credit"; amount: number; tendered: number | null; change: number | null; gift_card_code?: string | null };
type PaymentLine = { method: string; amount: number; tendered: number | null; change: number | null };
type Receipt = {
  id: string;
  saleNumber: number;
  businessName: string;
  customerName: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  comp: number;
  serviceCharge: number;
  serviceLabel: string;
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
    voids?: { name: string; unit_price: number; quantity: number; reason_code?: string; reason_note?: string }[];
    tip?: number;
    discount_type: "amount" | "percent";
    discount_value: number;
    discount_reason_code?: string;
    discount_reason_note?: string;
    comp_value?: number;
    comp_reason_code?: string;
    comp_reason_note?: string;
    service_charge?: boolean;
    service_charge_auto?: boolean;
    service_charge_waive_reason_code?: string;
    service_charge_waive_reason_note?: string;
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
    comp: number;
    serviceCharge: number;
    serviceLabel: string;
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
  comp: number;
  serviceCharge: number;
  serviceLabel: string;
  tax: number;
  tip: number;
  total: number;
  customerName: string | null;
};

function methodLabel(m: string): string {
  // Single shared formatter so receipts match Recent sales / Reports exactly.
  return formatPaymentMethod(m);
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
      allergy: it.allergy ?? null,
      seat: it.seat ?? null,
      shared_seats: (it as { shared_seats?: number[] | null }).shared_seats ?? null,
      course_id: it.course_id ?? null,
      fired_at: it.fired_at ?? null,
      void: it.void ?? null,
      guest: (it as { guest?: boolean }).guest === true,
    };
  });
}

export function RegisterClient({ items, taxRate, businessName, businessId, hasStaff, activeStaff, receiptSettings, showItemPhotos, categoryColors, serviceCharge, splitSettings, courses, loyalty, tableBinding, initialTableCart, onExitToFloor, staffList, priceWindows = [], timezone = "America/Toronto", upsellPrompts = [] }: { items: Item[]; taxRate: number; businessName: string; businessId?: string; hasStaff: boolean; activeStaff: ActiveStaff | null; receiptSettings: Partial<ReceiptSettings> | null; showItemPhotos: boolean; categoryColors: Record<string, string>; serviceCharge?: ServiceChargeCfg; splitSettings?: SplitCfg; courses?: Course[]; loyalty?: { enabled: boolean; redeemPerDollar: number }; tableBinding?: TableBinding; initialTableCart?: TableCart | null; onExitToFloor?: () => void; staffList?: StaffMember[]; priceWindows?: PriceWindow[]; timezone?: string; upsellPrompts?: UpsellPrompt[] }) {
  const [cart, setCart] = useState<CartLine[]>(() => hydrateTableLines(initialTableCart, items, taxRate));
  const online = useOnlineStatus();
  // P1-22: back up the quick-service cart (no table/tab — nothing server-side
  // until it's paid) to localStorage, so a reload or crash recovers the sale.
  // Table/to-go/tab carts already persist on the server, so they skip this.
  const draftKey = !tableBinding && businessId ? "surge_draft_cart_" + businessId : null;
  const draftRestored = useRef(false);
  useEffect(() => {
    if (!draftKey || draftRestored.current) return;
    draftRestored.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as CartLine[];
        if (Array.isArray(saved) && saved.length > 0) setCart(saved);
      }
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (cart.length > 0) localStorage.setItem(draftKey, JSON.stringify(cart));
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey, cart]);
  const [tip, setTip] = useState(initialTableCart?.tip ?? "");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">(initialTableCart?.discount_mode === "percent" ? "percent" : "amount");
  const [discountValue, setDiscountValue] = useState(initialTableCart?.discount_value ?? "");
  const [discountReason, setDiscountReason] = useState(initialTableCart?.discount_reason ?? "");
  const [discountReasonNote, setDiscountReasonNote] = useState(initialTableCart?.discount_reason_note ?? "");
  const [compValue, setCompValue] = useState("");
  const [compReason, setCompReason] = useState("");
  const [compReasonNote, setCompReasonNote] = useState("");
  // P0: comp/discount only count toward the total once AUTHORIZED (the cashier's
  // role permits + within cap, or a manager PIN approved). A persisted table-cart
  // discount was authorized when it was applied, so it loads authorized.
  const [compAuthorized, setCompAuthorized] = useState(false);
  const [discountAuthorized, setDiscountAuthorized] = useState(
    !!(initialTableCart?.discount_value && Number(initialTableCart.discount_value) > 0)
  );
  // The manager who authorized a sensitive action via PIN (recorded in the audit).
  const [approver, setApprover] = useState<{ id: string; name: string } | null>(null);
  // The action to run once a manager PIN authorizes it (set by authorizeAction).
  const pendingCommitRef = useRef<(() => void) | null>(null);
  // Service charge / auto-gratuity. Auto-applies for large parties; turning it
  // off (a waiver) is the sensitive, reason-coded action.
  const scCfg: ServiceChargeCfg = serviceCharge ?? { enabled: false, pct: 0, autoParty: 0, postTax: false, label: "Service charge" };
  const scGuests = tableBinding?.guestCount ?? 0;
  const scAvailable = scCfg.enabled && scCfg.pct > 0;
  const scAuto = scAvailable && scCfg.autoParty > 0 && scGuests >= scCfg.autoParty;
  const [serviceOn, setServiceOn] = useState<boolean>(scAuto);
  const [serviceWaiveReason, setServiceWaiveReason] = useState("");
  const [serviceWaiveNote, setServiceWaiveNote] = useState("");
  const splitCfg: SplitCfg = splitSettings ?? { settlementMode: "separate", allowUnits: false };
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitResult, setSplitResult] = useState<{ mode: "separate" | "informational"; orders: SplitResultOrder[] } | null>(null);
  const [mgrIntent, setMgrIntent] = useState<"tender" | "split" | "action">("tender");
  // What the manager is being asked to approve, for the modal copy.
  const [mgrAction, setMgrAction] = useState("this action");
  const [taxExempt, setTaxExempt] = useState(false);
  const [taxExemptReason, setTaxExemptReason] = useState("");
  const [taxExemptNote, setTaxExemptNote] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(initialTableCart?.customer ? { id: initialTableCart.customer.id, name: initialTableCart.customer.name } : null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null; tax_exempt: boolean }[]>([]);
  // P2-31b: the attached customer's loyalty balance (0 when none / loyalty off).
  const loyaltyOn = loyalty?.enabled === true && (loyalty?.redeemPerDollar ?? 0) > 0;
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  useEffect(() => {
    if (!loyaltyOn || !customer) { setLoyaltyBalance(0); return; }
    let cancelled = false;
    getLoyaltyBalance(customer.id).then((b) => { if (!cancelled) setLoyaltyBalance(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [customer, loyaltyOn]);
  // P2-33: the attached customer's store-credit balance (dollars; 0 when none).
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  useEffect(() => {
    if (!customer) { setStoreCreditBalance(0); return; }
    let cancelled = false;
    getStoreCreditBalance(customer.id).then((b) => { if (!cancelled) setStoreCreditBalance(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [customer]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [pickerItem, setPickerItem] = useState<Item | null>(null);
  const [pickerVariationId, setPickerVariationId] = useState<string | null>(null);
  const [pickerMods, setPickerMods] = useState<string[]>([]);
  // P1: kitchen note + allergen flags captured at add-item time (not just line-edit).
  const [pickerNote, setPickerNote] = useState("");
  const [pickerAllergens, setPickerAllergens] = useState<string[]>([]);
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
  // P1: async "Send for approval" from the register. Holds the request context
  // for the pending action, the in-flight request id while we poll, and the
  // terminal state so the modal can show waiting / approved / denied.
  const pendingApprovalRef = useRef<{ kind: string; amount?: number; reasonCode?: string; context?: string } | null>(null);
  const [awaitApprovalId, setAwaitApprovalId] = useState<string | null>(null);
  const [approvalState, setApprovalState] = useState<"idle" | "waiting" | "denied">("idle");
  // Which compact cart action sheet is open, and which cart line is being edited.
  const [sheet, setSheet] = useState<null | "discount" | "tip" | "tax" | "customer" | "comp" | "service">(null);
  const [editLineIndex, setEditLineIndex] = useState<number | null>(null);
  const [diningOption, setDiningOption] = useState<"dine_in" | "takeout" | "delivery" | "pickup">("dine_in");
  // Custom (open) item entry.
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  // Local 86 overrides so a long-press toggle reflects instantly.
  const [localOos, setLocalOos] = useState<Record<string, boolean>>({});
  // P0-13: live stock for the low-stock badge, kept in sync via Realtime.
  const [localStock, setLocalStock] = useState<Record<string, number>>({});
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);

  // P0-13: subscribe to catalog_items so a 86/un-86 or stock change on any
  // device (or auto-86 at zero on sale) reflects here within ~2s.
  useEffect(() => {
    if (!businessId) return;
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("pos-catalog-" + businessId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "catalog_items", filter: "business_id=eq." + businessId },
        (payload) => {
          const row = payload.new as { id?: string; out_of_stock?: boolean; stock_qty?: number | null };
          if (!row.id) return;
          setLocalOos((p) => ({ ...p, [row.id as string]: !!row.out_of_stock }));
          if (row.stock_qty !== undefined && row.stock_qty !== null) {
            setLocalStock((p) => ({ ...p, [row.id as string]: Number(row.stock_qty) }));
          }
        }
      )
      .subscribe();
    // RLS-protected realtime needs the user's token on the socket.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
    });
    return () => { supabase.removeChannel(channel); };
  }, [businessId]);
  // Server assigned to this table/to-go ticket (change-server).
  const [serverName, setServerName] = useState<string | null>(tableBinding?.serverName ?? null);
  const [serverSheet, setServerSheet] = useState(false);
  // E5: one-tap silent "call manager" alert with table context.
  const [mgrCalled, setMgrCalled] = useState(false);
  async function callManager() {
    if (mgrCalled) return;
    setMgrCalled(true);
    try { await requestManagerCall({ context: tableBinding?.tableLabel ?? undefined }); } catch { /* best-effort */ }
    setTimeout(() => setMgrCalled(false), 5000);
  }
  // Seat-level ordering: a real table (not takeout) splits its order by seat.
  const tableMode = !!(tableBinding && tableBinding.tableId);
  const [seatCount, setSeatCount] = useState<number>(() => {
    if (!tableMode) return 0;
    // Seat tabs follow the party: the ticket's guest count first, else the table's
    // drawn chairs, else a sensible default of 2 — never a hardcoded 4. Plus any
    // seat already used by an item, so assigning "Seat 5" survives a reload.
    // "+ Seat" adds more in-memory only: we deliberately never write guest_count
    // from the seat row, because guest count feeds the auto-gratuity threshold and
    // the seat tabs must never move the bill.
    let m = tableBinding?.guestCount || tableBinding?.seatCount || 2;
    for (const it of initialTableCart?.items ?? []) m = Math.max(m, Number(it.seat) || 0);
    return Math.max(m, 1);
  });
  const [activeSeat, setActiveSeat] = useState<number | null>(tableMode ? 1 : null);
  // P3: optional guest name per seat (keyed by seat number as a string).
  const [seatNames, setSeatNames] = useState<Record<string, string>>(initialTableCart?.seat_names ?? {});
  const seatName = (s: number | null) => (s != null ? (seatNames[String(s)] || "").trim() : "");

  // Coursing (P0-1): only on real full-service tables that have courses.
  const courseList = courses ?? [];
  const coursingOn = tableMode && courseList.length > 0;
  const firstCourseId = courseList[0]?.id ?? null;
  const courseById = new Map(courseList.map((c) => [c.id, c]));
  const itemDefaultCourse = new Map(items.map((i) => [i.id, i.default_course_id ?? null]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  function defaultCourseFor(catalogItemId: string | null): string | null {
    if (!coursingOn) return null;
    const fromItem = catalogItemId ? itemDefaultCourse.get(catalogItemId) ?? null : null;
    return fromItem || firstCourseId;
  }

  const itemTaxableById: Record<string, boolean> = {};
  const itemTaxFracById: Record<string, number> = {};
  for (const it of items) {
    itemTaxableById[it.id] = it.taxable;
    itemTaxFracById[it.id] = it.taxFrac;
  }

  // E1: resolve the active happy-hour window for an item at the current local
  // time (re-evaluated each render, so it switches on/off live during service).
  function nowDayMinute(): { weekday: number; minute: number } {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { weekday: weekday < 0 ? 0 : weekday, minute: hh * 60 + mm };
  }
  const { weekday: hhWeekday, minute: hhMinute } = priceWindows.length > 0 ? nowDayMinute() : { weekday: 0, minute: 0 };
  function activeWindow(item: Item): PriceWindow | null {
    if (priceWindows.length === 0) return null;
    return resolveWindow(priceWindows, { id: item.id, category: item.category }, hhWeekday, hhMinute);
  }

  // E6: suggestive-selling — when a trigger item is rung in, surface its prompts.
  type Suggestion = { item: Item; label: string; discount: number };
  const [upsellModal, setUpsellModal] = useState<Suggestion[] | null>(null);
  function maybeUpsell(item: Item) {
    if (upsellPrompts.length === 0) return;
    const matches = upsellPrompts.filter(
      (p) => (p.triggerScope === "item" && p.triggerItemId === item.id) || (p.triggerScope === "category" && !!p.triggerCategory && (item.category || "") === p.triggerCategory)
    );
    const sugg: Suggestion[] = [];
    for (const p of matches) {
      const si = itemById.get(p.suggestItemId);
      if (!si || isOos(si)) continue;
      if (sugg.some((s) => s.item.id === si.id)) continue;
      sugg.push({ item: si, label: p.label || ("Add " + si.name + "?"), discount: Math.max(0, p.comboDiscount) });
    }
    if (sugg.length > 0) setUpsellModal(sugg);
  }
  function addSuggested(s: Suggestion) {
    // Items needing choices open their picker (combo discount skipped there);
    // simple items add directly at the combo price.
    if (s.item.variations.length > 0 || s.item.modifiers.length > 0) {
      setUpsellModal(null);
      addItem(s.item);
      return;
    }
    const win = activeWindow(s.item);
    const base = win ? windowPrice(s.item.price, win) : s.item.price;
    addLine({ catalog_item_id: s.item.id, variation_id: null, name: s.item.name, unit_price: Math.max(0, Math.round((base - s.discount) * 100) / 100), taxable: s.item.taxable, taxFrac: s.item.taxFrac });
    setUpsellModal(null);
  }

  // E4/E7: saved tickets (quick-tickets + favorite rounds) + granular re-order.
  const [savedTickets, setSavedTickets] = useState<SavedTicket[]>([]);
  const refreshSaved = () => listSavedTickets().then(setSavedTickets).catch(() => {});
  useEffect(() => { refreshSaved(); }, []);
  const [saveDialog, setSaveDialog] = useState<{ scope: "quick" | "favorite"; name: string } | null>(null);
  const [repeatPicker, setRepeatPicker] = useState<Set<number> | null>(null);

  function addSavedLines(lines: SavedLine[]) {
    if (!lines || lines.length === 0) return;
    setReceipt(null);
    setCart((prev) => {
      const add: CartLine[] = lines.map((l) => ({
        catalog_item_id: l.catalog_item_id,
        variation_id: l.variation_id,
        name: l.name,
        unit_price: l.unit_price, // preserve the saved ring (modifiers/variation baked in)
        quantity: Math.max(1, l.quantity),
        taxable: l.taxable,
        taxFrac: l.catalog_item_id ? (itemTaxFracById[l.catalog_item_id] ?? taxRate) : (l.taxable ? taxRate : 0),
        sent_qty: 0,
        note: l.note ?? null,
        allergy: l.allergy ?? null,
        seat: tableMode ? activeSeat : null,
        course_id: l.course_id ?? defaultCourseFor(l.catalog_item_id),
        fired_at: null,
        void: null,
      }));
      return [...prev, ...add];
    });
  }

  function buildSavedFromCart(): SavedLine[] {
    return cart.filter((l) => !l.void).map((l) => ({
      catalog_item_id: l.catalog_item_id,
      variation_id: l.variation_id,
      name: l.name,
      unit_price: l.unit_price,
      quantity: l.quantity,
      taxable: l.taxable,
      note: l.note ?? null,
      allergy: l.allergy ?? null,
      course_id: l.course_id ?? null,
    }));
  }

  async function doSaveTicket() {
    if (!saveDialog) return;
    const res = await saveSavedTicket({ name: saveDialog.name, scope: saveDialog.scope, lines: buildSavedFromCart() });
    if ("error" in res) return; // dialog stays open; minimal
    setSaveDialog(null);
    refreshSaved();
  }

  // The lines of the most recent fired round (for the partial-round re-order picker).
  function lastRoundLines(): CartLine[] {
    const sent = cart.filter((l) => !l.void && (l.sent_qty ?? 0) > 0);
    if (sent.length === 0) return [];
    const firedAts = sent.map((l) => l.fired_at).filter((x): x is string => !!x);
    if (firedAts.length === 0) return sent;
    const latest = firedAts.slice().sort().at(-1) ?? null;
    return sent.filter((l) => (l.fired_at ?? null) === latest);
  }
  function repeatSelected(lines: CartLine[]) {
    if (lines.length === 0) return;
    setReceipt(null);
    setCart((prev) => [...prev, ...lines.map((l) => ({ ...l, sent_qty: 0, fired_at: null, void: null }))]);
  }

  const categories = Array.from(new Set(items.map((i) => i.category).filter((c): c is string => !!c)));
  const visibleItems = items.filter((i) => {
    if (activeCat !== "All" && (i.category || "") !== activeCat) return false;
    const t = search.trim().toLowerCase();
    if (t && !i.name.toLowerCase().includes(t)) return false;
    return true;
  });
  // Group the visible items under category headers so even a small menu reads as
  // organized sections rather than a few oversized tiles in a sea of empty space.
  const groupedItems = (() => {
    const byCat = new Map<string, typeof items>();
    for (const it of visibleItems) {
      const c = it.category && it.category.trim() ? it.category : "Other";
      const arr = byCat.get(c) ?? [];
      arr.push(it);
      byCat.set(c, arr);
    }
    return [...categories, "Other"]
      .filter((c) => byCat.has(c))
      .map((c) => ({ cat: c, list: byCat.get(c) as typeof items }));
  })();

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

  function addLine(line: { catalog_item_id: string | null; variation_id: string | null; name: string; unit_price: number; taxable: boolean; taxFrac: number; note?: string | null; allergy?: string | null }) {
    setReceipt(null);
    const seat = tableMode ? activeSeat : null;
    const note = line.note && line.note.trim() ? line.note.trim() : null;
    const allergy = line.allergy && line.allergy.trim() ? line.allergy.trim() : null;
    setCart((prev) => {
      // A line carrying a note/allergy is kept distinct (don't merge it into an
      // existing plain line — the kitchen instructions differ).
      const match = (l: CartLine) =>
        l.catalog_item_id === line.catalog_item_id &&
        l.variation_id === line.variation_id &&
        l.name === line.name &&
        (l.seat ?? null) === (seat ?? null) &&
        !note && !allergy && !l.note && !l.allergy;
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
          course_id: defaultCourseFor(line.catalog_item_id),
          note: note,
          allergy: allergy,
        },
      ];
    });
  }

  function addItem(item: Item) {
    if (item.variations.length > 0 || item.modifiers.length > 0) {
      setReceipt(null);
      setPickerVariationId(null);
      setPickerMods([]);
      setPickerNote("");
      setPickerAllergens([]);
      setPickerItem(item);
      return;
    }
    const win = activeWindow(item);
    addLine({ catalog_item_id: item.id, variation_id: null, name: item.name, unit_price: win ? windowPrice(item.price, win) : item.price, taxable: item.taxable, taxFrac: item.taxFrac });
    maybeUpsell(item);
  }

  function isOos(item: Item): boolean {
    return localOos[item.id] ?? item.out_of_stock;
  }
  // P0-13: low-stock badge once a tracked item is at/under its reorder point.
  function isLowStock(item: Item): boolean {
    if (!item.track_inventory || item.reorder_point == null) return false;
    if (isOos(item)) return false;
    const qty = localStock[item.id] ?? (item.stock_qty ?? 0);
    return qty > 0 && qty <= item.reorder_point;
  }

  // P1: is this cart line's item currently 86'd (incl. a live kitchen 86 over
  // realtime)? Used to block firing/charging it and to raise the stop banner.
  function lineIsOos(l: CartLine): boolean {
    if (!l.catalog_item_id || l.void) return false;
    const it = itemById.get(l.catalog_item_id);
    if (!it) return false;
    return localOos[it.id] ?? it.out_of_stock;
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

  // P0-2: modifier groups for an item (falls back to one loose "Add-ons" group).
  function modGroupsOf(item: Item): ModifierGroup[] {
    if (item.modifierGroups && item.modifierGroups.length) return item.modifierGroups;
    if (item.modifiers.length) return [{ id: "all", name: "Add-ons", required: false, min_select: 0, max_select: null, options: item.modifiers }];
    return [];
  }
  // P0-3: the group an option belongs to, searching the whole nested tree.
  function pickerGroupOf(optId: string): ModifierGroup | undefined {
    if (!pickerItem) return undefined;
    let found: ModifierGroup | undefined;
    const walk = (g: ModifierGroup) => {
      if (g.options.some((o) => o.id === optId)) found = g;
      for (const o of g.options) if (o.child_group) walk(o.child_group);
    };
    for (const g of modGroupsOf(pickerItem)) walk(g);
    return found;
  }
  // Every option id under a group's subtree (used to clear nested picks).
  function descendantOptionIds(g: ModifierGroup): string[] {
    const ids: string[] = [];
    for (const o of g.options) {
      ids.push(o.id);
      if (o.child_group) ids.push(...descendantOptionIds(o.child_group));
    }
    return ids;
  }
  function togglePickerMod(id: string) {
    const g = pickerGroupOf(id);
    const opt = g?.options.find((o) => o.id === id);
    setPickerMods((prev) => {
      if (prev.includes(id)) {
        // Deselecting: also clear anything chosen in this option's follow-up.
        let next = prev.filter((x) => x !== id);
        if (opt?.child_group) {
          const sub = new Set(descendantOptionIds(opt.child_group));
          next = next.filter((x) => !sub.has(x));
        }
        return next;
      }
      if (g && g.max_select === 1) {
        // Single-select: the new choice replaces any prior one (and its subtree).
        const drop = new Set<string>();
        for (const o of g.options) { drop.add(o.id); if (o.child_group) descendantOptionIds(o.child_group).forEach((x) => drop.add(x)); }
        return [...prev.filter((x) => !drop.has(x)), id];
      }
      if (g && g.max_select != null) {
        const inGroup = prev.filter((x) => g.options.some((o) => o.id === x)).length;
        if (inGroup >= g.max_select) return prev; // at the group's max — ignore.
      }
      return [...prev, id];
    });
  }
  // The groups currently "active": top-level always, a child group only when its
  // parent option is selected. Required active groups gate confirm.
  function activeGroups(item: Item): ModifierGroup[] {
    const out: ModifierGroup[] = [];
    const walk = (g: ModifierGroup) => {
      out.push(g);
      for (const o of g.options) if (o.child_group && pickerMods.includes(o.id)) walk(o.child_group);
    };
    for (const g of modGroupsOf(item)) walk(g);
    return out;
  }
  function requiredUnmet(item: Item): ModifierGroup[] {
    return activeGroups(item).filter((g) => {
      const min = g.required ? Math.max(1, g.min_select) : g.min_select;
      if (min <= 0) return false;
      const count = pickerMods.filter((x) => g.options.some((o) => o.id === x)).length;
      return count < min;
    });
  }

  // Recursive picker rendering: a selected option reveals its follow-up group.
  function renderModGroup(g: ModifierGroup, depth: number) {
    const single = g.max_select === 1;
    const min = g.required ? Math.max(1, g.min_select) : g.min_select;
    const count = pickerMods.filter((x) => g.options.some((o) => o.id === x)).length;
    const unmet = min > 0 && count < min;
    const atMax = g.max_select != null && count >= g.max_select;
    const hint = single
      ? "Choose 1"
      : g.max_select != null
        ? (min > 0 ? "Choose " + min + "–" + g.max_select : "Choose up to " + g.max_select)
        : min > 0 ? "Choose at least " + min : "Optional";
    return (
      <div key={g.id} className={"space-y-2 mb-3 " + (depth > 0 ? "ml-2 pl-3 border-l border-border" : "")}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{g.name}</span>
          <span className={"text-[10px] " + (unmet ? "text-red-600" : "text-muted-foreground")}>{(g.required ? "Required · " : "") + hint}</span>
        </div>
        {g.options.map((m) => {
          const checked = pickerMods.includes(m.id);
          const disabled = !checked && atMax && !single;
          return (
            <div key={m.id} className="space-y-2">
              <button type="button" onClick={() => togglePickerMod(m.id)} disabled={disabled} className={"w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors disabled:opacity-40 " + (checked ? "border-foreground bg-accent" : "border-border hover:border-foreground/40 hover:bg-accent/50")}>
                <span className="flex items-center gap-2">
                  <span className={"w-4 h-4 border flex items-center justify-center text-[10px] " + (single ? "rounded-full" : "rounded") + " " + (checked ? "bg-foreground text-background border-foreground" : "border-muted-foreground")}>{checked ? "✓" : ""}</span>
                  <span className="text-sm font-medium">{m.name}</span>
                </span>
                {m.price > 0 && <span className="text-sm tabular-nums text-muted-foreground">{"+$" + m.price.toFixed(2)}</span>}
              </button>
              {checked && m.child_group && renderModGroup(m.child_group, depth + 1)}
            </div>
          );
        })}
      </div>
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
    const modTotal = chosen.reduce((s, m) => s + m.price, 0);
    if (chosen.length > 0) {
      unit = unit + modTotal;
      label = label + " (" + chosen.map((m) => "+ " + m.name).join(", ") + ")";
    }
    // E1: happy-hour — percent applies to the whole line; a set price replaces the
    // base (modifiers still add on top).
    const win = activeWindow(item);
    if (win) {
      unit = win.mode === "percent" ? windowPrice(unit, win) : Math.max(0, win.value + modTotal);
    }
    unit = Math.round(unit * 100) / 100;
    // Allergen chips compile into the per-line allergy string (the KDS + chit
    // already render `allergy`); the note rides alongside.
    const allergyStr = pickerAllergens.length > 0 ? allergenLabels(pickerAllergens).join(", ") : "";
    addLine({
      catalog_item_id: item.id,
      variation_id: varId,
      name: label,
      unit_price: unit,
      taxable: item.taxable,
      taxFrac: item.taxFrac,
      note: pickerNote,
      allergy: allergyStr,
    });
    setPickerItem(null);
    maybeUpsell(item);
  }

  function changeQty(index: number, delta: number) {
    setCart((prev) => {
      const cur = prev[index];
      if (!cur) return prev;
      const fired = cur.sent_qty ?? 0;
      let next = cur.quantity + delta;
      // A fired item can't be reduced below what's already in the kitchen (you
      // can't un-fire it) — and so can't be removed via the stepper. To take it
      // off, use Void. Increasing is fine (the new portion is unfired).
      if (fired > 0 && next < fired) next = fired;
      return prev
        .map((l, i) => (i === index ? { ...l, quantity: next } : l))
        .filter((l) => l.quantity > 0);
    });
  }

  // Remove a single cart line outright (used by the tap-to-edit line sheet).
  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setEditLineIndex(null);
  }

  // P1: removing a line branches on fired state.
  //  - UNFIRED line → a delete (needs the `delete_item_prepay` permission).
  //  - FIRED line → not a delete; it must go through the void flow (needs `void`
  //    + a reason + KDS notice). The Remove button is hidden for fired lines, so
  //    this is the unfired path; we still gate it and guard against fired items.
  function deleteUnfiredLine(index: number) {
    const line = cart[index];
    if (!line) return;
    if ((line.sent_qty ?? 0) > 0 || line.fired_at) return; // fired → use Void
    authorizeAction("delete_item_prepay", false, () => removeLine(index));
  }

  function setLineNote(index: number, note: string) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, note: note } : l)));
  }

  function setLineAllergy(index: number, allergy: string) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, allergy: allergy || null } : l)));
  }

  // Move a line to a different seat (null = shared).
  function setLineSeat(index: number, seat: number | null) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, seat: seat } : l)));
  }
  // E3: toggle a seat into/out of a line's shared set (≥2 seats → split across them).
  function toggleSharedSeat(index: number, seat: number) {
    setCart((prev) => prev.map((l, i) => {
      if (i !== index) return l;
      const cur = Array.isArray(l.shared_seats) ? l.shared_seats : [];
      const next = cur.includes(seat) ? cur.filter((s) => s !== seat) : [...cur, seat].sort((a, b) => a - b);
      return { ...l, shared_seats: next.length > 0 ? next : null };
    }));
  }

  // Move a line to a different course (P0-1). Free while unfired.
  function setLineCourse(index: number, courseId: string) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, course_id: courseId } : l)));
  }

  // P0-10: void a line (not made). Kept on the check for the record, excluded
  // from totals; if it was already fired, the kitchen is told to stop.
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  function commitVoid(index: number, reasonCode: string) {
    const line = cart[index];
    if (!line) return;
    const firedQty = line.sent_qty ?? 0;
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, void: { reason_code: reasonCode } } : l)));
    if (firedQty > 0 && tableBinding) {
      startTransition(async () => {
        await sendVoidNotice(tableBinding.ticketId, { name: line.name, quantity: firedQty });
      });
    }
    setVoidOpen(false);
    setVoidReason("");
    setEditLineIndex(null);
  }
  // P0: voiding a line requires the `void` permission; otherwise a manager PIN
  // must authorize it (the void doesn't apply until approved).
  function voidLine(index: number, reasonCode: string) {
    const line = cart[index];
    const meta = line
      ? {
          kind: "void",
          amount: Math.round(line.unit_price * line.quantity * 100) / 100,
          reasonCode,
          context:
            displayItemName(line.name) +
            (tableBinding?.tableLabel ? " · " + tableBinding.tableLabel : ""),
        }
      : undefined;
    authorizeAction("void", false, () => commitVoid(index, reasonCode), meta);
  }
  function unvoidLine(index: number) {
    setCart((prev) => prev.map((l, i) => (i === index ? { ...l, void: null } : l)));
  }

  // P0-6: move a line to another open check.
  const [moveTargets, setMoveTargets] = useState<{ ticketId: string; label: string }[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  function openMoveLine() {
    setError(null);
    startTransition(async () => {
      const targets = await listOpenTableTargets();
      setMoveTargets(tableBinding ? targets.filter((t) => t.ticketId !== tableBinding.ticketId) : targets);
      setMoveOpen(true);
    });
  }
  function moveLineTo(index: number, destTicketId: string) {
    const line = cart[index];
    if (!line) return;
    setError(null);
    startTransition(async () => {
      const res = await transferLineToTicket(destTicketId, {
        catalog_item_id: line.catalog_item_id,
        variation_id: line.variation_id,
        name: line.name,
        unit_price: line.unit_price,
        quantity: line.quantity,
        sent_qty: line.sent_qty ?? 0,
        note: line.note ?? null,
        seat: line.seat ?? null,
        course_id: line.course_id ?? null,
        fired_at: line.fired_at ?? null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      removeLine(index);
      setMoveOpen(false);
      setEditLineIndex(null);
    });
  }

  // P0-7: move this whole check to another table.
  const [moveTableTargets, setMoveTableTargets] = useState<{ elementId: string; label: string; occupied: boolean }[]>([]);
  const [moveTableOpen, setMoveTableOpen] = useState(false);
  function openMoveTable() {
    if (!tableBinding) return;
    setError(null);
    startTransition(async () => {
      const targets = await listTableMoveTargets(tableBinding.ticketId);
      setMoveTableTargets(targets);
      setMoveTableOpen(true);
    });
  }
  function doMoveTable(elementId: string) {
    if (!tableBinding) return;
    setError(null);
    startTransition(async () => {
      const res = await moveTicketToTable(tableBinding.ticketId, elementId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setMoveTableOpen(false);
      tableClosedRef.current = true; // the ticket now lives on another table
      if (onExitToFloor) onExitToFloor();
    });
  }

  // One cart line row (reused by the flat and seat-grouped layouts).
  function renderLine(line: CartLine, index: number) {
    return (
      <div key={index} className="flex items-center gap-2">
        <button type="button" onClick={() => { setEditLineIndex(index); setMoveOpen(false); setVoidOpen(false); }} className="min-w-0 flex-1 text-left">
          <div className={"text-sm font-medium truncate flex items-center gap-1.5 " + (line.void ? "line-through text-muted-foreground" : "")}>
            {line.guest && !line.void && <span className="shrink-0 text-[9px] font-semibold uppercase rounded bg-indigo-500/15 text-indigo-500 px-1 py-0.5">Guest</span>}
            <span className="truncate">{line.name}{line.void ? "  · Void" : ""}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {"$" + line.unit_price.toFixed(2) + " each" + (line.taxable ? "" : "  " + "·" + "  Tax-free") + (line.note ? "  " + "·" + "  " + line.note : "")}
          </div>
          {coursingOn && (
            <div className="text-[10px] mt-0.5 flex items-center gap-1.5">
              <span className="text-muted-foreground">{line.seat ? "Seat " + line.seat : "Shared"}</span>
              {line.quantity > 0 && (line.sent_qty ?? 0) >= line.quantity
                ? <span className="text-emerald-600">Fired</span>
                : <span className="text-amber-600">Held</span>}
            </div>
          )}
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => changeQty(index, -1)} disabled={(line.sent_qty ?? 0) > 0 && line.quantity <= (line.sent_qty ?? 0)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none disabled:opacity-40">-</button>
          <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
          <button type="button" onClick={() => changeQty(index, 1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">+</button>
        </div>
        <div className={"w-16 text-right text-sm font-semibold tabular-nums shrink-0 " + (line.void ? "line-through text-muted-foreground" : "")}>{"$" + (line.unit_price * line.quantity).toFixed(2)}</div>
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
      comp: comp,
      serviceCharge: serviceChargeAmt,
      serviceLabel: scCfg.label,
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
        allergy: l.allergy ?? null,
        seat: l.seat ?? null,
        shared_seats: l.shared_seats ?? null,
        course_id: l.course_id ?? null,
        fired_at: l.fired_at ?? null,
        void: l.void ?? null,
        guest: l.guest === true,
      })),
      tip: tip,
      discount_mode: discountMode,
      // P0: on a staffed till only an AUTHORIZED discount is persisted, so an
      // unauthorized draft can't be staged and silently auto-applied on reload.
      discount_value: !hasStaff || discountAuthorized ? discountValue : "",
      discount_reason: !hasStaff || discountAuthorized ? discountReason : "",
      discount_reason_note: !hasStaff || discountAuthorized ? discountReasonNote : "",
      customer: customer ? { id: customer.id, name: customer.name } : null,
      seat_names: seatNames,
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
  }, [tableBinding, cart, tip, discountMode, discountValue, discountReason, discountReasonNote, discountAuthorized, customer]);

  // Count of items not yet fired to the kitchen (table mode).
  const unsentCount = cart.reduce(
    (s, l) => s + Math.max(0, l.quantity - (l.sent_qty ?? 0)),
    0
  );
  const [sending, setSending] = useState(false);

  // Fire the new items to the kitchen, then mark them sent locally.
  function sendToKitchen() {
    if (!tableBinding || unsentCount === 0) return;
    const blocked = cart.find((l) => lineIsOos(l) && l.quantity > (l.sent_qty ?? 0));
    if (blocked) {
      setError(displayItemName(blocked.name) + " was 86'd by the kitchen — remove it before firing.");
      return;
    }
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

  // P1-19: "Repeat round" — re-add the most recently fired round (the lines that
  // share the latest fired_at) as fresh, not-yet-sent lines, so another identical
  // round can be fired with one tap. Falls back to repeating everything on the
  // ticket if nothing has been coursed/fired with a timestamp yet.
  const canRepeatRound =
    tableMode && cart.some((l) => !l.void && (l.sent_qty ?? 0) > 0);
  function repeatRound() {
    setCart((prev) => {
      const sent = prev.filter((l) => !l.void && (l.sent_qty ?? 0) > 0);
      if (sent.length === 0) return prev;
      const firedAts = sent.map((l) => l.fired_at).filter((x): x is string => !!x);
      let round = sent;
      if (firedAts.length > 0) {
        const latest = firedAts.slice().sort().at(-1) ?? null;
        round = sent.filter((l) => (l.fired_at ?? null) === latest);
      }
      if (round.length === 0) return prev;
      const dupes: CartLine[] = round.map((l) => ({
        catalog_item_id: l.catalog_item_id,
        variation_id: l.variation_id,
        name: l.name,
        unit_price: l.unit_price,
        quantity: l.quantity,
        taxable: l.taxable,
        taxFrac: l.taxFrac,
        sent_qty: 0,
        note: l.note ?? null,
        allergy: l.allergy ?? null,
        seat: l.seat ?? null,
        course_id: l.course_id ?? null,
        fired_at: null,
        void: null,
      }));
      return [...prev, ...dupes];
    });
  }

  // Coursing: how many items in a course still need firing, and the next course
  // with anything to fire (drives the "Fire [Course]" footer button).
  function courseUnsent(courseId: string): number {
    return cart.reduce((s, l) => s + ((l.course_id ?? null) === courseId ? Math.max(0, l.quantity - (l.sent_qty ?? 0)) : 0), 0);
  }
  const nextUnfiredCourse = coursingOn ? courseList.find((c) => courseUnsent(c.id) > 0) ?? null : null;

  // Fire just one course's new items to the kitchen, then mark them sent locally.
  function fireCourseClient(course: Course) {
    if (!tableBinding || courseUnsent(course.id) === 0) return;
    const blocked = cart.find(
      (l) => (l.course_id ?? null) === course.id && lineIsOos(l) && l.quantity > (l.sent_qty ?? 0)
    );
    if (blocked) {
      setError(displayItemName(blocked.name) + " was 86'd by the kitchen — remove it before firing.");
      return;
    }
    setError(null);
    setSending(true);
    startTransition(async () => {
      const res = await fireCourse(tableBinding.ticketId, buildTablePayload(), course.id, course.name, diningOption);
      setSending(false);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const nowIso = new Date().toISOString();
      setCart((prev) => prev.map((l) => ((l.course_id ?? null) === course.id ? { ...l, sent_qty: l.quantity, fired_at: nowIso } : l)));
    });
  }

  const [serverPin, setServerPin] = useState("");
  const [serverPinNeeded, setServerPinNeeded] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  function changeServer(member: StaffMember) {
    if (!tableBinding) return;
    setServerErr(null);
    startTransition(async () => {
      const res = await setTicketServer(tableBinding.ticketId, member.id, serverPin || undefined);
      if ("needs_approval" in res) {
        setServerPinNeeded(true);
        setServerErr("A manager PIN is needed to take another server's table.");
        return;
      }
      if ("error" in res) {
        setServerErr(res.error);
        return;
      }
      setServerName(member.name);
      setServerSheet(false);
      setServerPin("");
      setServerPinNeeded(false);
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
    setCompValue("");
    setCompReason("");
    setCompReasonNote("");
    setServiceOn(scAuto);
    setServiceWaiveReason("");
    setServiceWaiveNote("");
    setTaxExempt(false);
    setTaxExemptReason("");
    setTaxExemptNote("");
    setCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    setApproved(false);
    setApprover(null);
    setCompAuthorized(false);
    setDiscountAuthorized(false);
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

  // Idle auto-logout: sign the active cashier out after 90s of no interaction so
  // an unattended till can't ring under the last person's name. Only runs when a
  // staffed business actually has someone signed in.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // P2: kept fresh so the idle timeout can tell whether a check is open without
  // re-running the effect (which would lose the timer) on every cart change.
  const cartLenRef = useRef(cart.length);
  cartLenRef.current = cart.length;
  useEffect(() => {
    if (!hasStaff || !staff) return;
    const IDLE_LOGOUT_MS = 90_000;
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        // P2: NEVER blank the cashier while a check is open — that drops
        // attribution mid-sale (and would disable the permission gate). An open
        // check keeps its cashier until it closes or they explicitly sign out.
        if (cartLenRef.current > 0) return;
        clearActiveStaff();
        setStaff(null);
      }, IDLE_LOGOUT_MS);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown"];
    events.forEach((e) => document.addEventListener(e, reset));
    reset();
    return () => {
      events.forEach((e) => document.removeEventListener(e, reset));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [hasStaff, staff]);

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
    // Record the approving manager for the audit trail (logged with the sale).
    setApprover({ id: res.id, name: res.name });
    setMgrOpen(false);
    setMgrPin("");
    setMgrErr(null);
    // P0: a per-action authorization (comp/discount/void) runs its pending commit
    // and does NOT proceed to tender.
    if (mgrIntent === "action") {
      const commit = pendingCommitRef.current;
      pendingCommitRef.current = null;
      setMgrIntent("tender");
      commit?.();
      return;
    }
    setApproved(true);
    if (mgrIntent === "split") {
      setSplitOpen(true);
    } else {
      setTenderOpen(true);
    }
  }

  function openSplit() {
    setError(null);
    if (cart.length === 0) return;
    if (total < 0) {
      setError("Total can't be negative.");
      return;
    }
    if (discount > 0 && !discountReasonOk) { setError("Choose a reason for the discount."); return; }
    if (comp > 0 && !compReasonOk) { setError("Choose a reason for the comp."); return; }
    if (scWaived && !serviceWaiveOk) { setError("Choose a reason for waiving the service charge."); return; }
    if (taxExempt && !taxExemptOk) { setError("Choose a reason for the tax exemption."); return; }
    if (needsManagerApproval && !approved) {
      setMgrAction(taxExempt ? "tax exemption" : "service-charge waive");
      setMgrIntent("split");
      setMgrErr(null);
      setMgrPin("");
      setMgrOpen(true);
      return;
    }
    setSplitOpen(true);
  }

  function submitSplit(checks: SplitCheck[]) {
    setError(null);
    if (cart.length === 0) return;

    // P0-4: on a real table, persist the split as independent child checks that
    // each pay later; the table stays open until the last child is paid.
    if (tableBinding && tableBinding.tableId) {
      startTransition(async () => {
        const children = checks.map((ck, i) => ({
          label: "Check " + (i + 1),
          cart: {
            items: ck.lines.map((l) => ({ catalog_item_id: l.catalog_item_id, variation_id: null, name: l.name, unit_price: l.unit_price, quantity: l.quantity, sent_qty: l.quantity, note: null, seat: null, course_id: null, fired_at: null })),
            tip: "",
          } as TableCart,
        }));
        const res = await splitTicketIntoChildren(tableBinding.ticketId, "item", children);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setSplitOpen(false);
        tableClosedRef.current = true; // stop autosave from refilling the emptied parent
        if (onExitToFloor) onExitToFloor();
      });
      return;
    }

    startTransition(async () => {
      const res = await finalizeSplitCheck({
        items: cart.map((l) => ({ catalog_item_id: l.catalog_item_id, name: l.name, unit_price: l.unit_price, quantity: l.quantity, taxable: l.taxable })),
        checks: checks,
        settlement: splitCfg.settlementMode,
        discount_type: discountMode,
        discount_value: discountInput,
        discount_reason_code: discount > 0 ? discountReason : undefined,
        discount_reason_note: discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
        comp_value: comp > 0 ? comp : undefined,
        comp_reason_code: comp > 0 ? compReason : undefined,
        comp_reason_note: comp > 0 && compReason === "other" ? compReasonNote.trim() : undefined,
        service_charge: serviceApplied || undefined,
        service_charge_waive_reason_code: scWaived ? serviceWaiveReason : undefined,
        service_charge_waive_reason_note: scWaived && serviceWaiveReason === "other" ? serviceWaiveNote.trim() : undefined,
        tax_exempt: taxExempt || undefined,
        tax_exempt_reason_code: taxExempt ? taxExemptReason : undefined,
        tax_exempt_reason_note: taxExempt && taxExemptReason === "other" ? taxExemptNote.trim() : undefined,
        customer_id: customer ? customer.id : null,
        dining_option: diningOption,
        idempotency_key: nextIdemKey(),
        approver: approver ?? undefined,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSplitOpen(false);
      setSplitResult({ mode: res.mode, orders: res.orders });
      printSplitReceipts(res.orders);
      const firstId = res.orders[0] ? res.orders[0].id : "";
      clearCart();
      if (firstId) closeTableAfterCharge(firstId);
    });
  }

  function printSplitReceipts(orders: SplitResultOrder[]) {
    const cfg = getPrinterConfig();
    if (!cfg || !cfg.autoPrint) return;
    for (const o of orders) {
      const rec: Receipt = {
        id: o.id,
        saleNumber: o.sale_number,
        businessName,
        customerName: customer ? customer.name : null,
        items: o.items.map((it) => ({ catalog_item_id: null, variation_id: null, name: it.name, unit_price: it.unit_price, quantity: it.quantity, taxable: true, taxFrac: 0 })),
        subtotal: o.subtotal,
        discount: o.discount,
        comp: o.comp,
        serviceCharge: o.service_charge,
        serviceLabel: scCfg.label,
        tax: o.tax,
        tip: o.tip,
        total: o.total,
        paymentMethod: o.payment_method,
        payments: [{ method: o.payment_method, amount: o.total, tendered: null, change: null }],
        at: new Date().toLocaleString(),
        diningOption: diningOption,
      };
      doPrint(rec);
    }
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

  // Voided lines are kept in the cart for the record but excluded from charge.
  const subtotal = cart.reduce((sum, l) => sum + (l.void ? 0 : l.unit_price * l.quantity), 0);
  const voidLines = cart.filter((l) => l.void);
  const voidTotalAmt = Math.round(voidLines.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 100) / 100;

  // P0: on a staffed till an unauthorized discount does NOT reduce the total (or
  // reach the payload). Non-staffed tills (QSR/retail) apply live, as before.
  const discountInput = !hasStaff || discountAuthorized ? parseFloat(discountValue) || 0 : 0;
  let discount = discountMode === "percent" ? subtotal * (discountInput / 100) : discountInput;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;

  // P2-31b: loyalty redemption is applied as a discount with the "loyalty_redeem"
  // reason. The most a customer can redeem is the lesser of their points (in $)
  // and the bill. The server re-derives points used from the final discount.
  const loyaltyApplied = loyaltyOn && discountReason === "loyalty_redeem" && discount > 0;
  const loyaltyMaxDollars =
    loyaltyOn && customer && loyaltyBalance > 0
      ? Math.floor(Math.min(loyaltyBalance / (loyalty as { redeemPerDollar: number }).redeemPerDollar, subtotal) * 100) / 100
      : 0;
  function redeemLoyalty() {
    if (loyaltyMaxDollars <= 0) return;
    setDiscountMode("amount");
    setDiscountValue(loyaltyMaxDollars.toFixed(2));
    setDiscountReason("loyalty_redeem");
    setDiscountReasonNote("");
    // Loyalty redemption is the customer spending their own points, not a
    // discretionary discount — it self-authorizes (no manager needed).
    setDiscountAuthorized(true);
  }
  function clearLoyalty() {
    setDiscountValue("");
    setDiscountReason("");
    setDiscountAuthorized(false);
  }

  // Comp (on-the-house): pre-tax reduction after discount, capped to remaining.
  // P0: on a staffed till an unauthorized comp does NOT reduce the total (or
  // reach the payload). Non-staffed tills (QSR/retail) apply live, as before.
  let comp = !hasStaff || compAuthorized ? parseFloat(compValue) || 0 : 0;
  if (comp < 0) comp = 0;
  if (comp > discountedSubtotal) comp = discountedSubtotal;
  comp = Math.round(comp * 100) / 100;
  const netSubtotal = Math.round((discountedSubtotal - comp) * 100) / 100;

  const taxF = subtotal > 0 ? netSubtotal / subtotal : 0;

  const taxBucketsPreview: Record<string, number> = {};
  for (const l of cart) {
    if (l.void) continue;
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

  // Service charge mirrors the server's authoritative formula for display.
  const serviceApplied = scAvailable && serviceOn;
  const scBase = serviceApplied ? (scCfg.postTax ? Math.round((netSubtotal + tax) * 100) / 100 : netSubtotal) : 0;
  const serviceChargeAmt = serviceApplied ? Math.round(scBase * (scCfg.pct / 100) * 100) / 100 : 0;
  // P0-10c: a large-party charge is a taxable auto-gratuity (HST added to tax);
  // a manually-applied charge stays an untaxed service charge.
  const scIsAuto = scAuto && serviceApplied;
  const autoGratAmt = scIsAuto ? serviceChargeAmt : 0;
  const manualScAmt = scIsAuto ? 0 : serviceChargeAmt;
  const autoGratTax = scIsAuto && !effectiveExempt ? Math.round(autoGratAmt * taxRate * 100) / 100 : 0;
  tax = Math.round((tax + autoGratTax) * 100) / 100;
  const scWaived = scAuto && !serviceOn;
  const serviceWaiveOk =
    !scWaived ||
    (serviceWaiveReason !== "" && (serviceWaiveReason !== "other" || serviceWaiveNote.trim().length > 0));

  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((netSubtotal + tax + manualScAmt + autoGratAmt + tipNum) * 100) / 100;

  // P3-45 customer-facing display: mirror the live cart to /cfd/<businessId> over a
  // Realtime broadcast channel. Display-only; no DB writes, no money-path coupling.
  const cfdChannelRef = useRef<ReturnType<ReturnType<typeof createBrowserClient>["channel"]> | null>(null);
  useEffect(() => {
    if (!businessId) return;
    const supabase = createBrowserClient();
    const ch = supabase.channel("cfd-" + businessId, { config: { broadcast: { self: false } } });
    ch.subscribe();
    cfdChannelRef.current = ch;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
    });
    return () => {
      cfdChannelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [businessId]);
  useEffect(() => {
    const ch = cfdChannelRef.current;
    if (!ch || !businessId) return;
    const visible = cart.filter((l) => !l.void);
    const status = receipt && cart.length === 0 ? "paid" : visible.length > 0 ? "cart" : "idle";
    ch.send({
      type: "broadcast",
      event: "state",
      payload: {
        businessName,
        status,
        items: visible.map((l) => ({ name: l.name, quantity: l.quantity, unit_price: l.unit_price })),
        subtotal,
        tax,
        total,
        customerName: customer?.name ?? null,
        paidTotal: receipt?.total ?? null,
        saleNumber: receipt?.saleNumber ?? null,
      },
    });
  }, [cart, subtotal, tax, total, receipt, customer, businessId, businessName]);

  const discountReasonOk =
    discount <= 0 ||
    (discountReason !== "" && (discountReason !== "other" || discountReasonNote.trim().length > 0));

  const compReasonOk =
    comp <= 0 ||
    (compReason !== "" && (compReason !== "other" || compReasonNote.trim().length > 0));

  const taxExemptOk =
    !taxExempt ||
    (taxExemptReason !== "" && (taxExemptReason !== "other" || taxExemptNote.trim().length > 0));

  const cardEnabled = !!(cardCfg && cardCfg.enabled);

  const cashierRole = staff ? (staff as { role?: string }).role : null;
  const cashierPerms = staff ? ((staff as { permissions?: string[] }).permissions ?? []) : [];
  const cashierCan = (p: string) => cashierPerms.includes(p);
  const compCap = staff ? (staff as { compCap?: number | null }).compCap ?? null : null;
  const discountCap = staff ? (staff as { discountCap?: number | null }).discountCap ?? null : null;

  // P0: comp / discount / void are authorized AT THE ACTION (authorizeAction),
  // so by close they're already approved with the approver recorded. The close
  // gate only covers tax-exempt + service-charge waive (no direct permission
  // key) — and FAILS CLOSED: an unknown/null cashier always needs a manager PIN,
  // never default-allow.
  const needsManagerApproval =
    (taxExempt || scWaived) && (!staff || cashierRole !== "manager");

  // The single authorization chokepoint for a sensitive register action. Fails
  // closed: a null/unknown cashier is never authorized. If the cashier's role
  // grants the permission and the amount is within cap, it commits immediately;
  // otherwise a manager PIN must authorize it first (the action does not apply
  // until then), and that manager is recorded as the approver.
  function authorizeAction(
    permission: string,
    overCap: boolean,
    commit: () => void,
    approvalMeta?: { kind: string; amount?: number; reasonCode?: string; context?: string }
  ) {
    // Businesses that don't use staff PINs (QSR / retail / transportation) have
    // no register permission system — apply directly, exactly as before. The
    // gate only engages for staffed full-service tills.
    if (!hasStaff) {
      commit();
      return;
    }
    const authorized = !!staff && cashierCan(permission) && !overCap;
    if (authorized) {
      commit();
      return;
    }
    const labels: Record<string, string> = {
      comp: "comp",
      discount: "discount",
      void: "void",
      delete_item_prepay: "item removal",
      change_tax: "tax change",
    };
    pendingCommitRef.current = commit;
    // Only void supports the async queue today (matches /app/approvals scope).
    pendingApprovalRef.current = approvalMeta && approvalMeta.kind === "void" ? approvalMeta : null;
    setApprovalState("idle");
    setAwaitApprovalId(null);
    setMgrAction(labels[permission] ?? "action");
    setMgrIntent("action");
    setMgrErr(null);
    setMgrPin("");
    setMgrOpen(true);
  }

  // Dismiss the manager-approval modal without applying the pending action (and
  // without disturbing the action sheet underneath it).
  function cancelMgr() {
    pendingCommitRef.current = null;
    pendingApprovalRef.current = null;
    setAwaitApprovalId(null);
    setApprovalState("idle");
    setMgrIntent("tender");
    setMgrErr(null);
    setMgrPin("");
    setMgrOpen(false);
  }

  // P1: send the pending (void) action to the async approvals queue instead of
  // entering a manager PIN here. Creates the request, then polls until a manager
  // decides — on approve we apply the held action on this device; on deny we say so.
  function sendForApproval() {
    const meta = pendingApprovalRef.current;
    if (!meta) return;
    setMgrErr(null);
    setMgrBusy(true);
    startTransition(async () => {
      const res = await requestRegisterApproval({
        kind: meta.kind,
        amount: meta.amount,
        reasonCode: meta.reasonCode,
        context: meta.context,
      });
      setMgrBusy(false);
      if ("error" in res) {
        setMgrErr(res.error);
        return;
      }
      setAwaitApprovalId(res.id);
      setApprovalState("waiting");
    });
  }

  // Poll the in-flight approval request; apply or reject when a manager decides.
  useEffect(() => {
    if (!awaitApprovalId || approvalState !== "waiting") return;
    let alive = true;
    const tick = async () => {
      const res = await getApprovalStatus(awaitApprovalId);
      if (!alive || !res || "error" in res) return;
      if (res.status === "approved") {
        const commit = pendingCommitRef.current;
        pendingCommitRef.current = null;
        pendingApprovalRef.current = null;
        setAwaitApprovalId(null);
        setApprovalState("idle");
        setMgrOpen(false);
        setMgrIntent("tender");
        if (commit) commit();
      } else if (res.status === "denied") {
        pendingCommitRef.current = null;
        pendingApprovalRef.current = null;
        setAwaitApprovalId(null);
        setApprovalState("denied");
      }
    };
    const id = setInterval(tick, 3000);
    tick();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [awaitApprovalId, approvalState]);

  function applyComp() {
    const amt = parseFloat(compValue) || 0;
    if (amt <= 0) {
      setCompAuthorized(false);
      setSheet(null);
      return;
    }
    if (!compReasonOk) {
      setError("Choose a reason for the comp.");
      return;
    }
    const overCap = compCap != null && amt > compCap;
    authorizeAction("comp", overCap, () => {
      setCompAuthorized(true);
      setSheet(null);
    });
  }

  function applyDiscount() {
    const amt = parseFloat(discountValue) || 0;
    if (amt <= 0) {
      setDiscountAuthorized(false);
      setSheet(null);
      return;
    }
    if (!discountReasonOk) {
      setError("Choose a reason for the discount.");
      return;
    }
    const dollar = discountMode === "percent" ? Math.round(subtotal * (amt / 100) * 100) / 100 : amt;
    const overCap = discountCap != null && dollar > discountCap;
    authorizeAction("discount", overCap, () => {
      setDiscountAuthorized(true);
      setSheet(null);
    });
  }

  function snapshot(): Snap {
    return {
      items: cart,
      subtotal: subtotal,
      discount: discount,
      comp: comp,
      serviceCharge: serviceChargeAmt,
      serviceLabel: scCfg.label,
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
      comp: snap.comp,
      serviceCharge: snap.serviceCharge,
      serviceLabel: snap.serviceLabel,
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
      items: cart.filter((l) => !l.void),
      voids: voidLines.length > 0 ? voidLines.map((l) => ({ name: l.name, unit_price: l.unit_price, quantity: l.quantity, reason_code: l.void?.reason_code, reason_note: l.void?.reason_note })) : undefined,
      tip: tipNum,
      idempotency_key: nextIdemKey(),
      discount_type: discountMode,
      discount_value: discountInput,
      discount_reason_code: discount > 0 ? discountReason : undefined,
      discount_reason_note:
        discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
      comp_value: comp > 0 ? comp : undefined,
      comp_reason_code: comp > 0 ? compReason : undefined,
      comp_reason_note:
        comp > 0 && compReason === "other" ? compReasonNote.trim() : undefined,
      service_charge: serviceApplied || undefined,
      service_charge_auto: scIsAuto || undefined,
      service_charge_waive_reason_code: scWaived ? serviceWaiveReason : undefined,
      service_charge_waive_reason_note:
        scWaived && serviceWaiveReason === "other" ? serviceWaiveNote.trim() : undefined,
      tax_exempt: taxExempt || undefined,
      tax_exempt_reason_code: taxExempt ? taxExemptReason : undefined,
      tax_exempt_reason_note:
        taxExempt && taxExemptReason === "other" ? taxExemptNote.trim() : undefined,
      customer_id: customer ? customer.id : null,
      dining_option: diningOption,
      approver: approver ?? undefined,
      // Phase A: carry the table ticket so covers / seated-at / section persist on the order.
      open_ticket_id: tableBinding?.ticketId ?? undefined,
    };
  }

  function openTender() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }
    // P1: a line 86'd by the kitchen can't be sold. Block on the unfired portion
    // (anything already fired was made before the 86 and is fine to charge).
    const blocked86 = cart.find((l) => lineIsOos(l) && l.quantity > (l.sent_qty ?? 0));
    if (blocked86) {
      setError(displayItemName(blocked86.name) + " was 86'd by the kitchen — remove it before charging.");
      return;
    }
    // A sale must be attributed to a cashier/server before it can close, so
    // By-server reporting is never blank and the "Unassigned" sale is gone. This
    // now covers EVERY close path (table + togo/quick sale), not just tables.
    // Gated to `hasStaff`, so businesses with no staff configured
    // (quick-service / retail / transportation) close exactly as before. The
    // server action enforces the same rule as the real backstop.
    if (hasStaff && !staff) {
      setError("Enter your cashier PIN to close this sale.");
      openStaffPin();
      return;
    }
    if (total < 0) {
      setError("Total can't be negative.");
      return;
    }
    if (discount > 0 && !discountReasonOk) {
      setError("Choose a reason for the discount.");
      return;
    }
    if (comp > 0 && !compReasonOk) {
      setError("Choose a reason for the comp.");
      return;
    }
    if (scWaived && !serviceWaiveOk) {
      setError("Choose a reason for waiving the service charge.");
      return;
    }
    if (taxExempt && !taxExemptOk) {
      setError("Choose a reason for the tax exemption.");
      return;
    }
    if (needsManagerApproval && !approved) {
      setMgrAction(taxExempt ? "tax exemption" : "service-charge waive");
      setMgrIntent("tender");
      setMgrErr(null);
      setMgrPin("");
      setMgrOpen(true);
      return;
    }
    if (total === 0) {
      finalizeZero();
      return;
    }
    setTenderOpen(true);
  }

  // A fully-comped (or all-free) check closes at $0 without the tender sheet.
  function finalizeZero() {
    setError(null);
    if (cart.length === 0) return;
    const snap = snapshot();
    startTransition(async () => {
      const res = await createOrder({ ...commonOrderFields(), payment_method: "other" });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      finishSale(res, "other", [{ method: "other", amount: 0, tendered: null, change: null }], snap);
    });
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
        payments: tenders.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered, gift_card_code: p.method === "gift_card" ? p.gift_card_code ?? null : null })),
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
        items: cart.filter((l) => !l.void),
        voids: voidLines.length > 0 ? voidLines.map((l) => ({ name: l.name, unit_price: l.unit_price, quantity: l.quantity, reason_code: l.void?.reason_code, reason_note: l.void?.reason_note })) : undefined,
        tip: tipNum,
        discount_type: discountMode,
        discount_value: discountInput,
        discount_reason_code: discount > 0 ? discountReason : undefined,
        discount_reason_note:
          discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
        comp_value: comp > 0 ? comp : undefined,
        comp_reason_code: comp > 0 ? compReason : undefined,
        comp_reason_note:
          comp > 0 && compReason === "other" ? compReasonNote.trim() : undefined,
        service_charge: serviceApplied || undefined,
        service_charge_auto: scIsAuto || undefined,
        service_charge_waive_reason_code: scWaived ? serviceWaiveReason : undefined,
        service_charge_waive_reason_note:
          scWaived && serviceWaiveReason === "other" ? serviceWaiveNote.trim() : undefined,
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
        comp: comp,
        serviceCharge: serviceChargeAmt,
        serviceLabel: scCfg.label,
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
      comp: m.receipt.comp,
      serviceCharge: m.receipt.serviceCharge,
      serviceLabel: m.receipt.serviceLabel,
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
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onClick={cancelMgr}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Manager approval</h3>
              <button type="button" onClick={cancelMgr} className="text-xs text-muted-foreground underline">
                Cancel
              </button>
            </div>
            {approvalState === "waiting" ? (
              <div className="py-6 text-center space-y-2">
                <div className="mx-auto w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
                <p className="text-sm font-medium">Waiting for a manager to approve&hellip;</p>
                <p className="text-xs text-muted-foreground">Sent to Approvals. This applies automatically once approved.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">{"This " + mgrAction + " needs a manager" + "\u2019" + "s PIN."}</p>
                {approvalState === "denied" && (
                  <p className="text-sm text-red-600 mb-2">A manager declined the request. Enter a PIN to override, or cancel.</p>
                )}
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
                {mgrAction === "void" && (
                  <button
                    type="button"
                    onClick={sendForApproval}
                    disabled={mgrBusy}
                    className="mt-2 w-full h-10 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
                  >
                    No manager? Send for approval
                  </button>
                )}
                {mgrErr && <p className="text-sm text-red-600 mt-2">{mgrErr}</p>}
              </>
            )}
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
                <div className="text-xs text-muted-foreground">Choose one</div>
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

            {modGroupsOf(pickerItem).map((g) => renderModGroup(g, 0))}

            {/* P1: allergen flags + kitchen note at add time (red on the KDS + chit). */}
            <div className="space-y-2 mb-3 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground">Allergy alert</div>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map((a) => {
                  const on = pickerAllergens.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() =>
                        setPickerAllergens((prev) =>
                          prev.includes(a.key) ? prev.filter((k) => k !== a.key) : [...prev, a.key]
                        )
                      }
                      className={
                        "text-xs rounded-full border px-2.5 py-1 transition-colors " +
                        (on
                          ? "border-red-600 bg-red-600 text-white font-medium"
                          : "border-border hover:border-red-600/50 hover:bg-red-600/5")
                      }
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
              <Input
                value={pickerNote}
                onChange={(e) => setPickerNote(e.target.value)}
                placeholder="Kitchen note (e.g. no onions, well done)"
                className="h-10"
              />
            </div>

            <Button className="w-full" onClick={confirmOptions} disabled={(pickerItem.variations.length > 0 && !pickerVariationId) || requiredUnmet(pickerItem).length > 0}>
              {requiredUnmet(pickerItem).length > 0 ? "Choose " + requiredUnmet(pickerItem)[0].name : "Add to cart - $" + pickerUnitPrice(pickerItem).toFixed(2)}
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

      {/* E6: suggestive-selling prompt after a trigger item is rung in. */}
      {upsellModal && upsellModal.length > 0 && (
        <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setUpsellModal(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Anything else?</h3>
            <div className="space-y-2">
              {upsellModal.map((s, i) => {
                const win = activeWindow(s.item);
                const base = win ? windowPrice(s.item.price, win) : s.item.price;
                const price = Math.max(0, Math.round((base - s.discount) * 100) / 100);
                return (
                  <button key={i} type="button" onClick={() => addSuggested(s)} className="w-full flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:bg-accent">
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-sm tabular-nums shrink-0">
                      ${price.toFixed(2)}
                      {s.discount > 0 && <span className="ml-1 text-[11px] text-emerald-600">combo</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button variant="outline" className="w-full mt-3" onClick={() => setUpsellModal(null)}>No thanks</Button>
          </div>
        </div>
      )}

      {/* E7: name + save the current cart as a quick ticket / favorite. */}
      {saveDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setSaveDialog(null)}>
          <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Save ticket</h3>
            <Input autoFocus value={saveDialog.name} onChange={(e) => setSaveDialog({ ...saveDialog, name: e.target.value })} placeholder="Name (e.g. Pint + wings)" className="h-10 mb-3" />
            <div className="flex gap-2 mb-3">
              {(["quick", "favorite"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSaveDialog({ ...saveDialog, scope: s })} className={"flex-1 text-sm rounded-md border px-2 py-2 " + (saveDialog.scope === s ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>
                  {s === "quick" ? "Quick ticket" : "★ Favorite"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => startTransition(doSaveTicket)} disabled={pending || !saveDialog.name.trim()}>Save</Button>
              <Button variant="outline" onClick={() => setSaveDialog(null)} disabled={pending}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* E4: partial-round re-order — pick which items from the last round to re-add. */}
      {repeatPicker && (() => {
        const lines = lastRoundLines();
        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={() => setRepeatPicker(null)}>
            <div className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-medium mb-1">Repeat items</h3>
              <p className="text-xs text-muted-foreground mb-3">Re-add just what you want from the last round — e.g. another round of drinks.</p>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing in the last round.</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {lines.map((l, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm py-1">
                      <input type="checkbox" checked={repeatPicker.has(i)} onChange={(e) => { const next = new Set(repeatPicker); if (e.target.checked) next.add(i); else next.delete(i); setRepeatPicker(next); }} className="h-4 w-4" />
                      <span className="flex-1">{l.quantity > 1 ? l.quantity + "× " : ""}{l.name}{l.seat ? " · S" + l.seat : ""}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { repeatSelected(lines.filter((_, i) => repeatPicker.has(i))); setRepeatPicker(null); }} disabled={repeatPicker.size === 0}>Add {repeatPicker.size}</Button>
                <Button variant="outline" onClick={() => setRepeatPicker(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        );
      })()}

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
        storeCreditBalance={storeCreditBalance}
        onCash={recordCash}
        onSplit={recordSplit}
        onCardManual={recordCardManual}
        onCardRecord={recordCardNoCharge}
      />

      <SplitSheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        lines={cart.map((l) => ({ catalog_item_id: l.catalog_item_id, name: l.name, unit_price: l.unit_price, quantity: l.quantity, taxable: l.taxable, seat: l.seat ?? null, shared_seats: l.shared_seats ?? null }))}
        allowUnits={splitCfg.allowUnits}
        settlementMode={splitCfg.settlementMode}
        pending={pending}
        onConfirm={submitSplit}
      />

      {splitResult && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSplitResult(null)}>
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg w-full sm:max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium">{splitResult.mode === "separate" ? "Split paid — " + splitResult.orders.length + " seats" : "Check paid — split breakdown"}</h3>
              <button type="button" onClick={() => setSplitResult(null)} className="text-xs text-muted-foreground underline">Done</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {splitResult.orders.map((o) => (
                <div key={o.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{o.label}{splitResult.mode === "separate" ? " · #" + o.sale_number : ""}</span>
                    <span className="text-sm tabular-nums font-semibold">{"$" + o.total.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {o.items.map((it, k) => (
                      <div key={k} className="flex justify-between"><span className="truncate pr-2">{it.name}{it.quantity > 1 ? " ×" + it.quantity : ""}</span><span className="tabular-nums">{"$" + (it.unit_price * it.quantity).toFixed(2)}</span></div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-border/60"><span>Tax{o.service_charge > 0 ? " + charge" : ""}</span><span className="tabular-nums">{"$" + (o.tax + o.service_charge).toFixed(2)}</span></div>
                    {splitResult.mode === "separate" && <div className="flex justify-between capitalize"><span>{o.payment_method}</span><span className="tabular-nums">{"$" + o.total.toFixed(2)}</span></div>}
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-1">
                <span>Total collected</span>
                <span className="tabular-nums">{"$" + splitResult.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {receipt.comp > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Comp</span>
                  <span className="tabular-nums text-red-600">{"-$" + receipt.comp.toFixed(2)}</span>
                </div>
              )}
              {receipt.serviceCharge > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{receipt.serviceLabel}</span>
                  <span className="tabular-nums">{"$" + receipt.serviceCharge.toFixed(2)}</span>
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
          {/* P1-22: offline warning — payment and firing need a connection. */}
          {!online && (
            <div className="shrink-0 flex items-center gap-2 bg-amber-500/15 border-b border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              You&apos;re offline. Keep building the check &mdash; firing and payment will resume when you&apos;re back online.
            </div>
          )}
          {/* Slim dark top bar */}
          <div className="shrink-0 flex items-center justify-between gap-3 h-12 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="font-semibold truncate">{tableBinding ? tableBinding.tableLabel : businessName}</span>
              {tableBinding && (
                <span className="text-xs text-sidebar-foreground/70 truncate hidden sm:inline">{businessName}</span>
              )}
              {hasStaff && (
                staff ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-sidebar-foreground/70 truncate hidden sm:inline">
                      Ringing as {staff.name}
                    </span>
                    <button type="button" onClick={openStaffPin} className="text-xs text-sidebar-foreground/70 underline hover:text-sidebar-foreground">Switch</button>
                    <button type="button" onClick={signOutStaff} disabled={staffBusy} className="text-xs text-sidebar-foreground/70 underline hover:text-sidebar-foreground">Sign out</button>
                  </span>
                ) : (
                  <button type="button" onClick={openStaffPin} className="shrink-0">
                    <Chip tone="warning" dot>No cashier — Enter PIN</Chip>
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tableBinding && staffList && staffList.length > 0 && (
                <button type="button" onClick={() => setServerSheet(true)} className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent">
                  {serverName ? serverName : "Assign server"}
                </button>
              )}
              {tableMode && (
                <button type="button" onClick={openMoveTable} disabled={pending} className="flex items-center gap-1.5 text-xs rounded-md border border-sidebar-border px-2.5 py-1.5 hover:bg-sidebar-accent disabled:opacity-50">
                  Move
                </button>
              )}
              {hasStaff && (
                <button
                  type="button"
                  onClick={callManager}
                  disabled={mgrCalled}
                  title="Silently alert a manager"
                  className={"flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 " + (mgrCalled ? "border-emerald-500/50 text-emerald-400" : "border-sidebar-border hover:bg-sidebar-accent")}
                >
                  {mgrCalled ? "✓ Manager alerted" : "🛎️ Manager"}
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

                {/* E7/E4: quick tickets + favorites — one tap to add a saved set of items. */}
                {(savedTickets.length > 0 || cart.some((l) => !l.void)) && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {savedTickets.map((t) => (
                      <span key={t.id} className="shrink-0 inline-flex items-center rounded-full border border-border overflow-hidden">
                        <button type="button" onClick={() => addSavedLines(t.lines)} className="text-xs px-2.5 py-1.5 hover:bg-accent" title={"Add " + t.lines.length + " item" + (t.lines.length === 1 ? "" : "s")}>
                          {t.scope === "favorite" ? "★ " : ""}{t.name}
                        </button>
                        <button type="button" onClick={() => { if (confirm("Delete saved ticket “" + t.name + "”?")) startTransition(async () => { await deleteSavedTicket(t.id); refreshSaved(); }); }} className="px-1.5 py-1.5 text-muted-foreground hover:text-red-600 border-l border-border" title="Delete">×</button>
                      </span>
                    ))}
                    {cart.some((l) => !l.void) && (
                      <button type="button" onClick={() => setSaveDialog({ scope: "quick", name: "" })} className="shrink-0 text-xs rounded-full border border-dashed border-border px-2.5 py-1.5 text-muted-foreground hover:bg-accent">＋ Save ticket</button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
                {visibleItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">No items match. Add some in the Catalog, or clear the search.</p>
                ) : (
                  groupedItems.map(({ cat, list }) => (
                    <div key={cat}>
                      <div className="text-xs font-semibold tracking-tight text-muted-foreground mb-2 px-0.5">{cat}</div>
                      {/* Fixed responsive columns cap the tile size so a few items
                          stay normal-sized (no oversized auto-fit stretch). */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                        {list.map((item) => {
                          const hasVars = item.variations.length > 0;
                          const hhWin = activeWindow(item); // E1
                          const hhPrice = hhWin && !hasVars ? windowPrice(item.price, hhWin) : null;
                          const priceLabel = hasVars
                            ? "From $" + Math.min(...item.variations.map((v) => v.price)).toFixed(2)
                            : hhPrice != null
                              ? "$" + hhPrice.toFixed(2)
                              : "$" + item.price.toFixed(2);
                          const oos = isOos(item);
                          const low = isLowStock(item);
                          // A7: show the live remaining count ("3 left") so staff can pace a
                          // low item; it auto-86s at 0 (decrement-on-sale + trigger).
                          const lowN = low ? (localStock[item.id] ?? (item.stock_qty ?? 0)) : 0;
                          if (showItemPhotos && item.image_url) {
                            return (
                              <button key={item.id} type="button" onClick={() => tileClick(item)} onPointerDown={() => tileDown(item)} onPointerUp={tileUp} onPointerLeave={tileUp} className={"relative min-h-[110px] rounded-xl border border-line shadow-elevation-sm overflow-hidden active:scale-[0.97] transition-transform " + (oos ? "opacity-50" : "")}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                                {low && <span className="absolute top-1 right-1 text-[10px] rounded-full bg-amber-500 text-white px-1.5 py-0.5 font-medium">{lowN} left</span>}
                                {hhWin && !oos && <span className="absolute top-1 left-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5 font-medium">HH</span>}
                                <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-left px-2 py-1.5">
                                  <div className="font-semibold text-sm leading-snug line-clamp-2">{item.name}</div>
                                  <div className="text-xs text-white/90">{oos ? "86'd" : priceLabel}</div>
                                </div>
                              </button>
                            );
                          }
                          return (
                            <button key={item.id} type="button" onClick={() => tileClick(item)} onPointerDown={() => tileDown(item)} onPointerUp={tileUp} onPointerLeave={tileUp} className={"relative text-left p-3 min-h-[110px] rounded-xl border shadow-elevation-sm active:scale-[0.97] transition-all flex flex-col justify-between " + tileClassesFor(item.category, categoryColors) + (oos ? " opacity-50" : "")}>
                              {low && <span className="absolute top-1 right-1 text-[10px] rounded-full bg-amber-500 text-white px-1.5 py-0.5 font-medium">{lowN} left</span>}
                              {hhWin && !oos && <span className="absolute top-1 left-1 text-[10px] rounded-full bg-emerald-600 text-white px-1.5 py-0.5 font-medium">HH</span>}
                              <div className="font-semibold text-sm leading-snug line-clamp-3">{item.name}</div>
                              <div className="text-sm opacity-80 mt-1 tabular-nums">{oos ? "86'd" : priceLabel}{hhPrice != null && <span className="ml-1 text-xs line-through opacity-50">${item.price.toFixed(2)}</span>}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
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
                <>
                <div className="shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-border overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
                  <button type="button" onClick={() => setActiveSeat(null)} className={"shrink-0 whitespace-nowrap text-sm rounded-lg border px-3.5 min-h-[44px] inline-flex items-center justify-center transition-colors" + (activeSeat === null ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>Shared</button>
                  {Array.from({ length: seatCount }, (_, i) => i + 1).map((s) => (
                    <button key={s} type="button" onClick={() => setActiveSeat(s)} className={"shrink-0 whitespace-nowrap text-sm rounded-lg border px-3.5 min-h-[44px] inline-flex items-center justify-center transition-colors" + (activeSeat === s ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground hover:bg-accent/50")}>{seatName(s) ? "S" + s + " · " + seatName(s) : "Seat " + s}</button>
                  ))}
                  <button type="button" onClick={() => setSeatCount((n) => Math.min(n + 1, 30))} className="shrink-0 whitespace-nowrap text-sm rounded-lg border border-dashed border-border px-3 min-h-[44px] inline-flex items-center text-muted-foreground hover:bg-accent/50">+ Seat</button>
                </div>
                {activeSeat != null && (
                  <div className="shrink-0 px-2 pb-2 border-b border-border">
                    <input
                      value={seatNames[String(activeSeat)] ?? ""}
                      onChange={(e) => setSeatNames((prev) => ({ ...prev, [String(activeSeat)]: e.target.value.slice(0, 40) }))}
                      placeholder={"Guest name for Seat " + activeSeat + " (optional)"}
                      className="w-full h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                    />
                  </div>
                )}
                </>
              )}

              {(() => {
                const stopped = cart.filter((l) => lineIsOos(l) && l.quantity > (l.sent_qty ?? 0));
                if (stopped.length === 0) return null;
                const names = Array.from(new Set(stopped.map((l) => displayItemName(l.name))));
                return (
                  <div className="shrink-0 mx-4 mt-3 rounded-md border border-red-600/50 bg-red-600/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                    <span className="font-semibold">⛔ 86&apos;d by the kitchen:</span>{" "}
                    {names.join(", ")} — remove {names.length === 1 ? "it" : "them"} before firing or charging.
                  </div>
                );
              })()}

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tableMode ? "Pick a seat, then tap items to add to it." : "Tap items to add them to the sale."}</p>
                ) : !tableMode ? (
                  cart.map((line, index) => renderLine(line, index))
                ) : coursingOn ? (
                  <>
                    {courseList.map((course) => {
                      const entries = cart.map((l, i) => ({ l, i })).filter((e) => (e.l.course_id ?? null) === course.id);
                      if (entries.length === 0) return null;
                      entries.sort((a, b) => (a.l.seat ?? 99) - (b.l.seat ?? 99));
                      const unsent = entries.reduce((s, e) => s + Math.max(0, e.l.quantity - (e.l.sent_qty ?? 0)), 0);
                      return (
                        <div key={course.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">{course.name}</span>
                            {unsent > 0 ? (
                              <button type="button" onClick={() => fireCourseClient(course)} disabled={sending || pending} className="text-[11px] rounded-md border border-foreground px-2 py-0.5 hover:bg-accent disabled:opacity-50">{"Fire " + unsent}</button>
                            ) : (
                              <span className="text-[11px] text-emerald-600">Fired</span>
                            )}
                          </div>
                          {entries.map((e) => renderLine(e.l, e.i))}
                        </div>
                      );
                    })}
                    {(() => {
                      const orphan = cart.map((l, i) => ({ l, i })).filter((e) => { const cid = e.l.course_id ?? null; return !cid || !courseById.has(cid); });
                      if (orphan.length === 0) return null;
                      return (
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-muted-foreground">No course</span>
                          {orphan.map((e) => renderLine(e.l, e.i))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {[...Array.from({ length: seatCount }, (_, i) => i + 1), null].map((seat) => {
                      const entries = cart.map((l, i) => ({ l, i })).filter((e) => (e.l.seat ?? null) === seat);
                      if (seat === null && entries.length === 0) return null;
                      const sub = entries.reduce((s, e) => s + e.l.unit_price * e.l.quantity, 0);
                      return (
                        <div key={seat === null ? "shared" : "s" + seat} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">{seat === null ? "Shared" : seatName(seat) ? "Seat " + seat + " · " + seatName(seat) : "Seat " + seat}</span>
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
                    {coursingOn ? (
                      <Button variant="outline" className="flex-1 h-11" onClick={() => nextUnfiredCourse && fireCourseClient(nextUnfiredCourse)} disabled={pending || sending || !nextUnfiredCourse}>
                        {sending ? "Firing..." : nextUnfiredCourse ? "Fire " + nextUnfiredCourse.name + " (" + courseUnsent(nextUnfiredCourse.id) + ")" : "All fired"}
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1 h-11" onClick={sendToKitchen} disabled={pending || sending || unsentCount === 0}>
                        {sending ? "Sending..." : unsentCount > 0 ? "Send " + unsentCount : "All sent"}
                      </Button>
                    )}
                    {coursingOn && unsentCount > 0 && (
                      <Button variant="outline" className="h-11 px-3" onClick={sendToKitchen} disabled={pending || sending} title="Fire everything now">Send all</Button>
                    )}
                    {canRepeatRound && (
                      <Button variant="outline" className="h-11 px-3" onClick={repeatRound} disabled={pending || sending} title="Re-add the last round to fire again">Repeat round</Button>
                    )}
                    {canRepeatRound && (
                      <Button variant="outline" className="h-11 px-3" onClick={() => setRepeatPicker(new Set(lastRoundLines().map((_, i) => i)))} disabled={pending || sending} title="Re-add just some items from the last round">Repeat…</Button>
                    )}
                    {canRepeatRound && (
                      <Button variant="outline" className="h-11 px-3" onClick={() => { if (tableBinding) startTransition(async () => { await dropCheck(tableBinding.ticketId); }); }} disabled={pending || sending} title="Mark the check as presented to the guest">Drop check</Button>
                    )}
                    <Button variant="outline" className="flex-1 h-11" onClick={sendAndPay} disabled={pending}>
                      Send &amp; Pay
                    </Button>
                  </div>
                )}
                {loyaltyOn && customer && cart.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-border text-sm">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-amber-500">★</span>
                      <span className="truncate">{loyaltyBalance.toLocaleString() + " pts"}</span>
                    </span>
                    {loyaltyApplied ? (
                      <button type="button" onClick={clearLoyalty} className="shrink-0 text-xs rounded-md border border-foreground px-2.5 py-1.5 hover:bg-accent">
                        {"Redeemed -$" + discount.toFixed(2)} · Clear
                      </button>
                    ) : (
                      <button type="button" onClick={redeemLoyalty} disabled={loyaltyMaxDollars <= 0} className="shrink-0 text-xs rounded-md border border-border px-2.5 py-1.5 hover:bg-accent disabled:opacity-40">
                        {loyaltyMaxDollars > 0 ? "Redeem $" + loyaltyMaxDollars.toFixed(2) : "No points to redeem"}
                      </button>
                    )}
                  </div>
                )}
                {cart.length > 0 && (
                  <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
                    <button type="button" onClick={() => setSheet("discount")} className={"flex-1 min-w-[60px] rounded-md border px-1 py-2 text-center hover:bg-accent " + (discount > 0 ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] text-muted-foreground">Discount</div>
                      <div className="text-xs font-medium truncate">{discount > 0 ? "-$" + discount.toFixed(2) : "Add"}</div>
                    </button>
                    <button type="button" onClick={() => { setCompValue(""); setSheet("comp"); }} className={"flex-1 min-w-[60px] rounded-md border px-1 py-2 text-center hover:bg-accent " + (comp > 0 ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] text-muted-foreground">Comp</div>
                      <div className="text-xs font-medium truncate">{comp > 0 ? "-$" + comp.toFixed(2) : "Add"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("tip")} className={"flex-1 min-w-[60px] rounded-md border px-1 py-2 text-center hover:bg-accent " + (tipNum > 0 ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] text-muted-foreground">Tip</div>
                      <div className="text-xs font-medium truncate">{tipNum > 0 ? "$" + tipNum.toFixed(2) : "Add"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("tax")} className={"flex-1 min-w-[60px] rounded-md border px-1 py-2 text-center hover:bg-accent " + (effectiveExempt ? "border-emerald-600" : "border-border")}>
                      <div className="text-[10px] text-muted-foreground">Tax</div>
                      <div className={"text-xs font-medium truncate " + (effectiveExempt ? "text-emerald-600" : "")}>{effectiveExempt ? "Exempt" : "Applied"}</div>
                    </button>
                    <button type="button" onClick={() => setSheet("customer")} className={"flex-1 min-w-[60px] rounded-md border px-1 py-2 text-center hover:bg-accent " + (customer ? "border-foreground" : "border-border")}>
                      <div className="text-[10px] text-muted-foreground">Customer</div>
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
                  {comp > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Comp</span>
                      <span className="tabular-nums text-red-600">{"-$" + comp.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{effectiveExempt ? "Tax (exempt)" : "Tax"}</span>
                    <span className="tabular-nums">{"$" + tax.toFixed(2)}</span>
                  </div>
                  {scAvailable && (serviceApplied || scAuto) && (
                    <button type="button" onClick={() => setSheet("service")} className="w-full flex justify-between text-sm rounded px-1 -mx-1 hover:bg-accent/50">
                      <span className="text-muted-foreground text-left">{(scIsAuto ? "Auto-gratuity" : scCfg.label) + " (" + scCfg.pct + "%)" + (serviceApplied ? (scIsAuto ? " · taxed" : "") : " · waived")}</span>
                      <span className={"tabular-nums " + (serviceApplied ? "" : "text-muted-foreground line-through")}>{serviceApplied ? "$" + serviceChargeAmt.toFixed(2) : "$0.00"}</span>
                    </button>
                  )}
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

                  <Button variant="primary" className="w-full h-14 text-base mt-2" onClick={openTender} disabled={pending || cart.length === 0 || (discount > 0 && !discountReasonOk) || (comp > 0 && !compReasonOk) || (scWaived && !serviceWaiveOk) || (taxExempt && !taxExemptOk)}>
                    {"Charge" + (total > 0 ? " $" + total.toFixed(2) : "")}
                  </Button>
                  {splitSettings && total > 0 && (
                    <button type="button" onClick={openSplit} disabled={pending || cart.length === 0} className="w-full h-10 mt-1 rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50">
                      Split check
                    </button>
                  )}
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
                    <button type="button" onClick={() => changeQty(editLineIndex, -1)} disabled={(cart[editLineIndex].sent_qty ?? 0) > 0 && cart[editLineIndex].quantity <= (cart[editLineIndex].sent_qty ?? 0)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none disabled:opacity-40">-</button>
                    <span className="w-8 text-center text-base tabular-nums">{cart[editLineIndex].quantity}</span>
                    <button type="button" onClick={() => changeQty(editLineIndex, 1)} className="w-11 h-11 rounded-md border border-border hover:bg-accent text-lg leading-none">+</button>
                  </div>
                  <span className="text-base font-semibold tabular-nums">{"$" + (cart[editLineIndex].unit_price * cart[editLineIndex].quantity).toFixed(2)}</span>
                </div>
                {(cart[editLineIndex].sent_qty ?? 0) > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    🔒 Already sent to the kitchen — you can add more or change the note, but not reduce or remove it. To take it off, use Void.
                  </p>
                )}
                <div className="space-y-1 mt-3">
                  <Label className="text-xs">Kitchen note</Label>
                  <Input value={cart[editLineIndex].note ?? ""} onChange={(e) => setLineNote(editLineIndex, e.target.value)} placeholder="e.g. no onions, well done" className="h-10" />
                  {(cart[editLineIndex].sent_qty ?? 0) > 0 && (cart[editLineIndex].note ?? "").trim() !== "" && (
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-500">
                      ⚠ This item is already in the kitchen — walk over and tell them about this note in case they don&apos;t see it on the screen.
                    </p>
                  )}
                </div>
                <div className="space-y-1 mt-3">
                  <Label className="text-xs text-red-600 font-semibold">Allergy ⚠</Label>
                  <Input value={cart[editLineIndex].allergy ?? ""} onChange={(e) => setLineAllergy(editLineIndex, e.target.value)} placeholder="e.g. peanut allergy, shellfish" className="h-10" />
                </div>
                {tableMode && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Seat</Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button type="button" disabled={(cart[editLineIndex].sent_qty ?? 0) >= cart[editLineIndex].quantity} onClick={() => setLineSeat(editLineIndex, null)} className={"text-xs rounded-md border px-2.5 py-1.5 disabled:opacity-40 " + ((cart[editLineIndex].seat ?? null) === null ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>Shared</button>
                      {Array.from({ length: seatCount }, (_, i) => i + 1).map((s) => (
                        <button key={s} type="button" disabled={(cart[editLineIndex].sent_qty ?? 0) >= cart[editLineIndex].quantity} onClick={() => setLineSeat(editLineIndex, s)} className={"text-xs rounded-md border px-2.5 py-1.5 disabled:opacity-40 " + (cart[editLineIndex].seat === s ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {tableMode && seatCount >= 2 && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Shared across seats <span className="text-muted-foreground">(splits evenly between them)</span></Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {Array.from({ length: seatCount }, (_, i) => i + 1).map((s) => {
                        const on = (cart[editLineIndex!].shared_seats ?? []).includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleSharedSeat(editLineIndex!, s)} className={"text-xs rounded-md border px-2.5 py-1.5 " + (on ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>S{s}</button>
                        );
                      })}
                      {(cart[editLineIndex].shared_seats ?? []).length > 0 && (
                        <button type="button" onClick={() => setCart((prev) => prev.map((l, i) => (i === editLineIndex ? { ...l, shared_seats: null } : l)))} className="text-xs text-muted-foreground underline ml-1">clear</button>
                      )}
                    </div>
                    {(cart[editLineIndex].shared_seats ?? []).length === 1 && <p className="text-[11px] text-muted-foreground">Pick at least two seats to share.</p>}
                  </div>
                )}
                {coursingOn && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Course{(cart[editLineIndex].sent_qty ?? 0) >= cart[editLineIndex].quantity ? " (already fired)" : ""}</Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {courseList.map((co) => (
                        <button key={co.id} type="button" disabled={(cart[editLineIndex].sent_qty ?? 0) >= cart[editLineIndex].quantity} onClick={() => setLineCourse(editLineIndex, co.id)} className={"text-xs rounded-md border px-2.5 py-1.5 disabled:opacity-40 " + ((cart[editLineIndex].course_id ?? null) === co.id ? "border-foreground bg-accent font-medium" : "border-border text-muted-foreground")}>{co.name}</button>
                      ))}
                    </div>
                    {(cart[editLineIndex].sent_qty ?? 0) >= cart[editLineIndex].quantity && cart[editLineIndex].quantity > 0 && (
                      <p className="text-[11px] text-amber-600">Moving an already-fired item won&apos;t un-fire it in the kitchen.</p>
                    )}
                  </div>
                )}
                {tableMode && (
                  <div className="mt-4">
                    {!moveOpen ? (
                      <Button variant="outline" className="w-full" onClick={openMoveLine} disabled={pending}>Move to another check</Button>
                    ) : (
                      <div className="space-y-1 rounded-md border border-border p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Move to…</span>
                          <button type="button" onClick={() => setMoveOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
                        </div>
                        {moveTargets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No other open checks.</p>
                        ) : (
                          moveTargets.map((t) => (
                            <button key={t.ticketId} type="button" onClick={() => moveLineTo(editLineIndex, t.ticketId)} disabled={pending} className="w-full text-left text-sm rounded-md border border-border px-2 py-2 hover:bg-accent">{t.label}</button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* P0-10: void (recorded, manager-approved at charge) vs remove. */}
                {cart[editLineIndex].void ? (
                  <div className="mt-3 flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    <span className="text-amber-700 dark:text-amber-500">Voided</span>
                    <button type="button" onClick={() => unvoidLine(editLineIndex)} className="text-xs underline">Undo</button>
                  </div>
                ) : !voidOpen ? (
                  <Button variant="outline" className="w-full mt-3" onClick={() => { setVoidReason(""); setVoidOpen(true); }}>Void item</Button>
                ) : (
                  <div className="mt-3 space-y-1 rounded-md border border-border p-2">
                    <Label className="text-xs">Void reason</Label>
                    <select value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className="w-full h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                      <option value="">Select a reason…</option>
                      {VOID_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">{(cart[editLineIndex].sent_qty ?? 0) > 0 ? "This was fired — the kitchen will be told to stop." : "Recorded but not charged."} Needs a manager at checkout.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => setVoidOpen(false)}>Cancel</Button>
                      <Button className="flex-1 h-9" disabled={!voidReason} onClick={() => voidLine(editLineIndex, voidReason)}>Void</Button>
                    </div>
                  </div>
                )}
                {(cart[editLineIndex].sent_qty ?? 0) === 0 && !cart[editLineIndex].fired_at && (
                  <Button variant="outline" className="w-full mt-3 text-red-600" onClick={() => deleteUnfiredLine(editLineIndex)}>
                    Remove from sale
                  </Button>
                )}
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
                {serverPinNeeded && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Manager PIN</Label>
                    <Input type="password" inputMode="numeric" value={serverPin} onChange={(e) => setServerPin(e.target.value)} placeholder="4–6 digits" className="h-10" />
                    <p className="text-[11px] text-muted-foreground">Then tap the server again to confirm.</p>
                  </div>
                )}
                {serverErr && <p className="text-sm text-red-600 mt-2">{serverErr}</p>}
              </div>
            </div>
          )}

          {/* P0-7: move this check to another table */}
          {moveTableOpen && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setMoveTableOpen(false)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-xs max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium">Move to table</h3>
                  <button type="button" onClick={() => setMoveTableOpen(false)} className="text-xs text-muted-foreground underline">Cancel</button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">An occupied table merges the two checks.</p>
                <div className="space-y-1">
                  {moveTableTargets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No other tables.</p>
                  ) : (
                    moveTableTargets.map((t) => (
                      <button key={t.elementId} type="button" onClick={() => doMoveTable(t.elementId)} disabled={pending} className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm border border-border hover:bg-accent">
                        <span>{t.label}</span>
                        {t.occupied && <span className="text-[10px] text-amber-600">occupied · merge</span>}
                      </button>
                    ))
                  )}
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
                  <button type="button" onClick={applyDiscount} className="text-xs font-semibold underline">Apply</button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border border-border overflow-hidden text-sm">
                    <button type="button" onClick={() => { setDiscountMode("amount"); setDiscountAuthorized(false); }} className={"px-3 py-2 " + (discountMode === "amount" ? "bg-accent font-medium" : "hover:bg-accent/50")}>$</button>
                    <button type="button" onClick={() => { setDiscountMode("percent"); setDiscountAuthorized(false); }} className={"px-3 py-2 border-l border-border " + (discountMode === "percent" ? "bg-accent font-medium" : "hover:bg-accent/50")}>%</button>
                  </div>
                  <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => { setDiscountValue(e.target.value); setDiscountAuthorized(false); }} placeholder="0" className="flex-1 h-11 text-right" />
                </div>
                {(parseFloat(discountValue) || 0) > 0 && (
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

          {/* Comp sheet */}
          {sheet === "comp" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Comp (on the house)</h3>
                  <button type="button" onClick={applyComp} className="text-xs font-semibold underline">Apply</button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">A comp removes the cost of items as a courtesy. It is recorded separately from a discount and may require a manager.</p>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" step="0.01" value={compValue} onChange={(e) => { setCompValue(e.target.value); setCompAuthorized(false); }} placeholder="0.00" className="flex-1 h-11 text-right" />
                  <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => { setCompValue(discountedSubtotal.toFixed(2)); setCompAuthorized(false); }}>Whole check</Button>
                </div>
                {(parseFloat(compValue) || 0) > 0 && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Comp reason</Label>
                    <select value={compReason} onChange={(e) => setCompReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                      <option value="">Select a reason...</option>
                      {COMP_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    {compReason === "other" && (
                      <Input value={compReasonNote} onChange={(e) => setCompReasonNote(e.target.value)} placeholder="Reason note" className="h-10" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Service charge sheet */}
          {sheet === "service" && (
            <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={() => setSheet(null)}>
              <div className="bg-card border border-border rounded-t-2xl sm:rounded-lg p-4 w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{scCfg.label}</h3>
                  <button type="button" onClick={() => setSheet(null)} className="text-xs text-muted-foreground underline">Done</button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {"A " + scCfg.pct + "% " + scCfg.label.toLowerCase() + (scCfg.postTax ? " (on the post-tax amount)" : " (on the pre-tax amount)") + (scAuto ? " applies automatically to this party of " + scGuests + "." : " can be added to this check.")}
                </p>
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  <button type="button" onClick={() => setServiceOn(true)} className={"flex-1 px-3 py-2 " + (serviceOn ? "bg-accent font-medium" : "hover:bg-accent/50")}>Applied</button>
                  <button type="button" onClick={() => setServiceOn(false)} className={"flex-1 px-3 py-2 border-l border-border " + (!serviceOn ? "bg-accent font-medium" : "hover:bg-accent/50")}>{scAuto ? "Waive" : "Off"}</button>
                </div>
                {serviceApplied && (
                  <div className="flex justify-between text-sm mt-3">
                    <span className="text-muted-foreground">Charge</span>
                    <span className="tabular-nums">{"$" + serviceChargeAmt.toFixed(2)}</span>
                  </div>
                )}
                {scWaived && (
                  <div className="space-y-1 mt-3">
                    <Label className="text-xs">Reason for waiving</Label>
                    <select value={serviceWaiveReason} onChange={(e) => setServiceWaiveReason(e.target.value)} className="w-full h-10 rounded-md border border-border bg-transparent text-foreground px-2 text-sm">
                      <option value="">Select a reason...</option>
                      {SERVICE_CHARGE_WAIVE_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    {serviceWaiveReason === "other" && (
                      <Input value={serviceWaiveNote} onChange={(e) => setServiceWaiveNote(e.target.value)} placeholder="Reason note" className="h-10" />
                    )}
                    <p className="text-[11px] text-muted-foreground">Waiving an automatic {scCfg.label.toLowerCase()} may require a manager.</p>
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