"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder, searchCustomers, quickCreateCustomer } from "./actions";
import {
  holdTicket,
  listOpenTickets,
  resumeTicket,
  discardTicket,
  type OpenTicketSummary,
} from "./ticket-actions";
import { DISCOUNT_REASONS } from "./reason-codes";
import { setActiveStaff, clearActiveStaff, type ActiveStaff } from "./staff-session";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; taxable: boolean; taxFrac: number; variations: Variation[]; modifiers: Variation[] };
type CartLine = {
  catalog_item_id: string | null;
  variation_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  taxable: boolean;
  taxFrac: number;
};
type Customer = { id: string; name: string };
type PaymentLine = {
  method: string;
  amount: number;
  tendered: number | null;
  change: number | null;
};
type SplitLine = {
  id: number;
  method: "cash" | "card" | "other";
  amount: string;
  cashGiven: string;
};
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
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function methodLabel(m: string): string {
  if (m === "cash") return "Cash";
  if (m === "card") return "Card";
  if (m === "split") return "Split";
  return "Other";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printReceipt(r: Receipt) {
  const win = window.open("", "_blank", "width=340,height=640");
  if (!win) return;

  const rows = r.items
    .map(function (l) {
      return (
        "<tr><td>" +
        escapeHtml(l.name) +
        " x" +
        l.quantity +
        '</td><td style="text-align:right">$' +
        (l.unit_price * l.quantity).toFixed(2) +
        "</td></tr>"
      );
    })
    .join("");

  const discountRow =
    r.discount > 0
      ? '<tr><td>Discount</td><td style="text-align:right">-$' +
        r.discount.toFixed(2) +
        "</td></tr>"
      : "";

  const payRows = r.payments
    .map(function (p) {
      var line =
        "<tr><td>" +
        escapeHtml(methodLabel(p.method)) +
        '</td><td style="text-align:right">$' +
        p.amount.toFixed(2) +
        "</td></tr>";
      if (p.method === "cash" && p.change !== null && p.change > 0) {
        line +=
          '<tr><td style="font-size:10px">Cash given</td><td style="text-align:right;font-size:10px">$' +
          (p.tendered || 0).toFixed(2) +
          "</td></tr>" +
          '<tr><td style="font-size:10px">Change</td><td style="text-align:right;font-size:10px">$' +
          p.change.toFixed(2) +
          "</td></tr>";
      }
      return line;
    })
    .join("");

  const customerLine = r.customerName
    ? '<div class="center" style="font-size:11px">Customer: ' +
      escapeHtml(r.customerName) +
      "</div>"
    : "";

  const html =
    "<html><head><title>Receipt</title><style>" +
    "body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px;color:#000}" +
    "h2{text-align:center;font-size:14px;margin:4px 0}" +
    "table{width:100%;border-collapse:collapse}" +
    "td{padding:2px 0;vertical-align:top}" +
    ".line{border-top:1px dashed #000;margin:6px 0}" +
    ".tot td{font-weight:bold}" +
    ".center{text-align:center}" +
    "@media print{@page{margin:4mm}}" +
    "</style></head><body>" +
    "<h2>" +
    escapeHtml(r.businessName) +
    "</h2>" +
    '<div class="center" style="font-size:13px;font-weight:bold;margin:2px 0">Sale #' +
    r.saleNumber +
    "</div>" +
    '<div class="center">' +
    escapeHtml(r.at) +
    "</div>" +
    '<div class="center" style="font-size:10px">Ref: ' +
    escapeHtml(r.id.slice(0, 8)) +
    "</div>" +
    customerLine +
    '<div class="line"></div>' +
    "<table>" +
    rows +
    "</table>" +
    '<div class="line"></div>' +
    "<table>" +
    '<tr><td>Subtotal</td><td style="text-align:right">$' +
    r.subtotal.toFixed(2) +
    "</td></tr>" +
    discountRow +
    '<tr><td>Tax</td><td style="text-align:right">$' +
    r.tax.toFixed(2) +
    "</td></tr>" +
    '<tr><td>Tip</td><td style="text-align:right">$' +
    r.tip.toFixed(2) +
    "</td></tr>" +
    '<tr class="tot"><td>Total</td><td style="text-align:right">$' +
    r.total.toFixed(2) +
    "</td></tr>" +
    "</table>" +
    '<div class="line"></div>' +
    '<div class="center" style="font-size:11px;margin-bottom:2px">Payment</div>' +
    "<table>" +
    payRows +
    "</table>" +
    '<div class="center" style="margin-top:8px">Thank you!</div>' +
    "</body></html>";

  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function RegisterClient({ items, taxRate, businessName, hasStaff, activeStaff }: { items: Item[]; taxRate: number; businessName: string; hasStaff: boolean; activeStaff: ActiveStaff | null }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tip, setTip] = useState("");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [pickerItem, setPickerItem] = useState<Item | null>(null);
  const [pickerVariationId, setPickerVariationId] = useState<string | null>(null);
  const [pickerMods, setPickerMods] = useState<string[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [openTickets, setOpenTickets] = useState<OpenTicketSummary[]>([]);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const splitIdRef = useRef(1);
  const idemKeyRef = useRef<string | null>(null);
  const [staff, setStaff] = useState<ActiveStaff | null>(activeStaff);
  const [staffPinOpen, setStaffPinOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);

  const itemTaxableById: Record<string, boolean> = {};
  const itemTaxFracById: Record<string, number> = {};
  for (const it of items) {
    itemTaxableById[it.id] = it.taxable;
    itemTaxFracById[it.id] = it.taxFrac;
  }

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

  async function refreshTickets() {
    const t = await listOpenTickets();
    setOpenTickets(t);
  }

  function addLine(line: { catalog_item_id: string | null; variation_id: string | null; name: string; unit_price: number; taxable: boolean; taxFrac: number }) {
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find(
        (l) =>
          l.catalog_item_id === line.catalog_item_id &&
          l.variation_id === line.variation_id &&
          l.name === line.name
      );
      if (existing) {
        return prev.map((l) =>
          l.catalog_item_id === line.catalog_item_id &&
          l.variation_id === line.variation_id &&
          l.name === line.name
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
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

  function clearCart() {
    setCart([]);
    setTip("");
    setDiscountValue("");
    setDiscountReason("");
    setDiscountReasonNote("");
    setCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    idemKeyRef.current = null;
  }

  // One idempotency key per checkout attempt. It survives a failed/retried
  // submit (so a retry can't double-charge) and resets when the cart clears.
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

  function pickCustomer(c: { id: string; name: string }) {
    setCustomer({ id: c.id, name: c.name });
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

  // Per-item tax preview, bucketed by rate so rounding matches the server.
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

  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((discountedSubtotal + tax + tipNum) * 100) / 100;

  const discountReasonOk =
    discount <= 0 ||
    (discountReason !== "" && (discountReason !== "other" || discountReasonNote.trim().length > 0));

  // ---- Open tickets ----
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

  // ---- Split tender helpers ----
  function newSplitLine(method: "cash" | "card" | "other"): SplitLine {
    const id = splitIdRef.current;
    splitIdRef.current = id + 1;
    return { id: id, method: method, amount: "", cashGiven: "" };
  }

  function openSplit() {
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
    setSplitLines([newSplitLine("cash"), newSplitLine("card")]);
    setSplitOpen(true);
  }

  function closeSplit() {
    setSplitOpen(false);
    setSplitLines([]);
  }

  function updateSplitLine(id: number, patch: Partial<SplitLine>) {
    setSplitLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeSplitLine(id: number) {
    setSplitLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function addSplitLine(method: "cash" | "card" | "other") {
    setSplitLines((prev) => [...prev, newSplitLine(method)]);
  }

  function setRest(id: number) {
    setSplitLines((prev) => {
      const otherCents = prev
        .filter((l) => l.id !== id)
        .reduce((s, l) => s + Math.round((parseFloat(l.amount) || 0) * 100), 0);
      let restCents = Math.round(total * 100) - otherCents;
      if (restCents < 0) restCents = 0;
      const rest = (restCents / 100).toFixed(2);
      return prev.map((l) => (l.id === id ? { ...l, amount: rest } : l));
    });
  }

  const splitSumCents = splitLines.reduce(
    (s, l) => s + Math.round((parseFloat(l.amount) || 0) * 100),
    0
  );
  const splitRemainingCents = Math.round(total * 100) - splitSumCents;
  const splitRemaining = splitRemainingCents / 100;
  const splitCanComplete = total > 0 && splitRemainingCents === 0 && splitSumCents > 0;

  function lineChange(l: SplitLine): number | null {
    if (l.method !== "cash") return null;
    const given = l.cashGiven.trim() ? Math.round((parseFloat(l.cashGiven) || 0) * 100) / 100 : null;
    if (given === null) return null;
    const amt = Math.round((parseFloat(l.amount) || 0) * 100) / 100;
    const change = Math.round((given - amt) * 100) / 100;
    return change > 0 ? change : 0;
  }

  function handleComplete() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }
    if (discount > 0 && !discountReasonOk) {
      setError("Choose a reason for the discount.");
      return;
    }
    const attachedCustomer = customer;
    const snapItems = cart;
    const snapSubtotal = subtotal;
    const snapDiscount = discount;
    const snapTax = tax;
    const snapTip = tipNum;
    const snapTotal = total;
    const method = paymentMethod;
    startTransition(async () => {
      const res = await createOrder({
        items: cart,
        tip: tipNum,
        payment_method: method,
        idempotency_key: nextIdemKey(),
        discount_type: discountMode,
        discount_value: discountInput,
        discount_reason_code: discount > 0 ? discountReason : undefined,
        discount_reason_note:
          discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
        customer_id: attachedCustomer ? attachedCustomer.id : null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setReceipt({
        id: res.id,
        saleNumber: res.sale_number,
        businessName,
        customerName: attachedCustomer ? attachedCustomer.name : null,
        items: snapItems,
        subtotal: snapSubtotal,
        discount: snapDiscount,
        tax: snapTax,
        tip: snapTip,
        total: snapTotal,
        paymentMethod: method,
        payments: [{ method: method, amount: snapTotal, tendered: null, change: null }],
        at: new Date().toLocaleString(),
      });
      clearCart();
    });
  }

  function handleCompleteSplit() {
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
    const built = splitLines
      .map((l) => {
        const amt = Math.round((parseFloat(l.amount) || 0) * 100) / 100;
        const givenRaw = l.cashGiven.trim()
          ? Math.round((parseFloat(l.cashGiven) || 0) * 100) / 100
          : null;
        const tendered = l.method === "cash" ? givenRaw : null;
        const change =
          l.method === "cash" && tendered !== null
            ? Math.round((tendered - amt) * 100) / 100
            : null;
        return { method: l.method, amount: amt, tendered: tendered, change: change };
      })
      .filter((p) => p.amount > 0);

    const sumCents = built.reduce((s, p) => s + Math.round(p.amount * 100), 0);
    if (sumCents !== Math.round(total * 100)) {
      setError("Split amounts must add up to the total.");
      return;
    }

    const attachedCustomer = customer;
    const snapItems = cart;
    const snapSubtotal = subtotal;
    const snapDiscount = discount;
    const snapTax = tax;
    const snapTip = tipNum;
    const snapTotal = total;
    startTransition(async () => {
      const res = await createOrder({
        items: cart,
        tip: tipNum,
        payments: built.map((p) => ({ method: p.method, amount: p.amount, tendered: p.tendered })),
        idempotency_key: nextIdemKey(),
        discount_type: discountMode,
        discount_value: discountInput,
        discount_reason_code: discount > 0 ? discountReason : undefined,
        discount_reason_note:
          discount > 0 && discountReason === "other" ? discountReasonNote.trim() : undefined,
        customer_id: attachedCustomer ? attachedCustomer.id : null,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setReceipt({
        id: res.id,
        saleNumber: res.sale_number,
        businessName,
        customerName: attachedCustomer ? attachedCustomer.name : null,
        items: snapItems,
        subtotal: snapSubtotal,
        discount: snapDiscount,
        tax: snapTax,
        tip: snapTip,
        total: snapTotal,
        paymentMethod: "split",
        payments: built,
        at: new Date().toLocaleString(),
      });
      setSplitOpen(false);
      setSplitLines([]);
      clearCart();
    });
  }

  return (
    <>
      {staffPinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStaffPinOpen(false)}>
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

      {pickerItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPickerItem(null)}>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setHoldOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Hold ticket</h3>
              <button
                type="button"
                onClick={() => setHoldOpen(false)}
                className="text-xs text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Save this sale to resume later. The register will clear.
            </p>
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={holdLabel}
              onChange={(e) => setHoldLabel(e.target.value)}
              placeholder='e.g. "Table 5" or a name'
              className="h-9 mt-1"
            />
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTicketsOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Open tickets</h3>
              <button
                type="button"
                onClick={() => setTicketsOpen(false)}
                className="text-xs text-muted-foreground underline"
              >
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
                      <div className="text-sm font-medium truncate">
                        {t.label ? t.label : "Ticket"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.item_count +
                          (t.item_count === 1 ? " item" : " items") +
                          "  " +
                          "\u00b7" +
                          "  " +
                          "$" +
                          t.subtotal.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button className="flex-1" onClick={() => doResume(t.id)} disabled={ticketBusy}>
                        Resume
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => doDiscard(t.id)}
                        disabled={ticketBusy}
                      >
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

      {splitOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeSplit}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Split payment</h3>
              <button
                type="button"
                onClick={closeSplit}
                className="text-xs text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              {"Total $" + total.toFixed(2)}
            </div>

            <div className="space-y-2">
              {splitLines.map((l) => {
                const change = lineChange(l);
                return (
                  <div key={l.id} className="rounded-md border border-border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        {(["cash", "card", "other"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => updateSplitLine(l.id, { method: m })}
                            className={"px-2 py-1 " + (l.method === m ? "bg-accent font-medium" : "hover:bg-accent/50")}
                          >
                            {methodLabel(m)}
                          </button>
                        ))}
                      </div>
                      {splitLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSplitLine(l.id)}
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.amount}
                        onChange={(e) => updateSplitLine(l.id, { amount: e.target.value })}
                        placeholder="0.00"
                        className="flex-1 h-8 text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setRest(l.id)}
                        className="px-2 py-1 text-xs rounded-md border border-border hover:bg-accent whitespace-nowrap"
                      >
                        Rest
                      </button>
                    </div>
                    {l.method === "cash" && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Cash given</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.cashGiven}
                          onChange={(e) => updateSplitLine(l.id, { cashGiven: e.target.value })}
                          placeholder="optional"
                          className="w-28 h-8 text-right"
                        />
                      </div>
                    )}
                    {change !== null && change > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Change</span>
                        <span className="tabular-nums">{"$" + change.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => addSplitLine("cash")}
                className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
              >
                + Cash
              </button>
              <button
                type="button"
                onClick={() => addSplitLine("card")}
                className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
              >
                + Card
              </button>
              <button
                type="button"
                onClick={() => addSplitLine("other")}
                className="flex-1 px-2 py-1 text-xs rounded-md border border-border hover:bg-accent"
              >
                + Other
              </button>
            </div>

            <div className="flex justify-between text-sm mt-3 pt-2 border-t border-border">
              <span className="text-muted-foreground">Allocated</span>
              <span className="tabular-nums">{"$" + (splitSumCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>{splitRemainingCents < 0 ? "Over by" : "Remaining"}</span>
              <span className={"tabular-nums " + (splitRemainingCents === 0 ? "text-emerald-500" : "text-red-500")}>
                {"$" + Math.abs(splitRemaining).toFixed(2)}
              </span>
            </div>

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            <Button
              className="w-full mt-3"
              onClick={handleCompleteSplit}
              disabled={pending || !splitCanComplete}
            >
              {pending ? "Recording..." : "Complete split sale - $" + total.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                No items yet. Add some in the Catalog first.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map((item) => {
                  const hasVars = item.variations.length > 0;
                  const priceLabel = hasVars
                    ? "From $" + Math.min(...item.variations.map((v) => v.price)).toFixed(2)
                    : "$" + item.price.toFixed(2);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="text-left p-3 rounded-md border border-border hover:border-foreground/40 hover:bg-accent/50 transition-colors"
                    >
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{priceLabel}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            {hasStaff && (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">
                  <span className="text-muted-foreground">Ringing as </span>
                  <span className="font-medium">{staff ? staff.name : "Not set"}</span>
                </span>
                {staff ? (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={openStaffPin} className="text-xs text-muted-foreground underline hover:text-foreground">
                      Switch
                    </button>
                    <button type="button" onClick={signOutStaff} disabled={staffBusy} className="text-xs text-muted-foreground underline hover:text-foreground">
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={openStaffPin} className="text-xs font-medium underline hover:text-foreground">
                    Enter PIN
                  </button>
                )}
              </div>
            )}

            {openTickets.length > 0 && (
              <button
                type="button"
                onClick={() => setTicketsOpen(true)}
                className="w-full flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">Open tickets</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent tabular-nums">
                  {openTickets.length}
                </span>
              </button>
            )}

            {cart.length === 0 && receipt ? (
              <div className="space-y-3">
                <h2 className="font-medium">Sale complete</h2>
                <div className="text-xs text-muted-foreground">
                  {"Sale #" + receipt.saleNumber}
                </div>
                {receipt.customerName && (
                  <div className="text-xs text-muted-foreground">
                    {"Customer: " + receipt.customerName}
                  </div>
                )}
                <div className="text-sm space-y-1">
                  {receipt.items.map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate">
                        {l.name} x{l.quantity}
                      </span>
                      <span className="tabular-nums">
                        {"$" + (l.unit_price * l.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {receipt.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600">
                        {"-$" + receipt.discount.toFixed(2)}
                      </span>
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
                          {p.method === "cash" && p.change !== null && p.change > 0
                            ? " (change $" + p.change.toFixed(2) + ")"
                            : ""}
                        </span>
                        <span className="tabular-nums">{"$" + p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => printReceipt(receipt)}>
                    Print receipt
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setReceipt(null)}>
                    New sale
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">Current sale</h2>
                  {cart.length > 0 && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={openHold}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Hold
                      </button>
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items yet.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((line, index) => (
                      <div key={index} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{line.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {"$" + line.unit_price.toFixed(2) + (line.taxable ? "" : "  " + "\u00b7" + "  Tax-free")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeQty(index, -1)}
                            className="w-7 h-7 rounded-md border border-border hover:bg-accent"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQty(index, 1)}
                            className="w-7 h-7 rounded-md border border-border hover:bg-accent"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-border space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{"$" + subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Discount</span>
                    <div className="flex items-center gap-1">
                      <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setDiscountMode("amount")}
                          className={"px-2 py-1 " + (discountMode === "amount" ? "bg-accent font-medium" : "hover:bg-accent/50")}
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountMode("percent")}
                          className={"px-2 py-1 border-l border-border " + (discountMode === "percent" ? "bg-accent font-medium" : "hover:bg-accent/50")}
                        >
                          %
                        </button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        placeholder="0"
                        className="w-20 h-8 text-right"
                      />
                    </div>
                  </div>

                  {discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount applied</span>
                      <span className="tabular-nums text-red-600">{"-$" + discount.toFixed(2)}</span>
                    </div>
                  )}

                  {discount > 0 && (
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs">Discount reason</Label>
                      <select
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        className="w-full h-8 rounded-md border border-border bg-transparent text-foreground px-2 text-sm"
                      >
                        <option value="">Select a reason...</option>
                        {DISCOUNT_REASONS.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      {discountReason === "other" && (
                        <Input
                          value={discountReasonNote}
                          onChange={(e) => setDiscountReasonNote(e.target.value)}
                          placeholder="Reason note"
                          className="h-8"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="tabular-nums">{"$" + tax.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tip</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      placeholder="0.00"
                      className="w-24 h-8 text-right"
                    />
                  </div>
                  <div className="flex justify-between font-semibold pt-1">
                    <span>Total</span>
                    <span className="tabular-nums">{"$" + total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Customer (optional)</Label>
                  {customer ? (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm font-medium truncate">{customer.name}</span>
                      <button
                        type="button"
                        onClick={() => setCustomer(null)}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Input
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        placeholder="Search or add a customer"
                        className="h-9"
                      />
                      {customerQuery.trim() && (
                        <div className="mt-1 rounded-md border border-border divide-y divide-border overflow-hidden">
                          {searchingCustomers ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                          ) : customerResults.length > 0 ? (
                            customerResults.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => pickCustomer(c)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                              >
                                {c.name}
                                {c.phone ? (
                                  <span className="text-xs text-muted-foreground">
                                    {"  " + "\u00b7" + "  " + c.phone}
                                  </span>
                                ) : null}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                          )}
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            disabled={addingCustomer}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-accent"
                          >
                            {addingCustomer ? "Adding..." : 'Add new customer "' + customerQuery.trim() + '"'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Payment</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cash", "card", "other"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={"px-2 py-2 text-sm rounded-md border transition-colors " + (paymentMethod === m ? "border-foreground bg-accent font-medium" : "border-border hover:border-foreground/40")}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={openSplit}
                    disabled={cart.length === 0}
                    className="w-full px-2 py-2 text-sm rounded-md border border-border hover:border-foreground/40 transition-colors disabled:opacity-50"
                  >
                    Split payment...
                  </button>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  className="w-full"
                  onClick={handleComplete}
                  disabled={pending || cart.length === 0 || (discount > 0 && !discountReasonOk)}
                >
                  {pending ? "Recording..." : "Complete sale" + (total > 0 ? " - $" + total.toFixed(2) : "")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}