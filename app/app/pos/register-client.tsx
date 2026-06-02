"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder, searchCustomers, quickCreateCustomer } from "./actions";

type Variation = { id: string; name: string; price: number };
type Item = { id: string; name: string; price: number; category: string | null; variations: Variation[] };
type CartLine = {
  catalog_item_id: string | null;
  variation_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
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

export function RegisterClient({ items, taxRate, businessName }: { items: Item[]; taxRate: number; businessName: string }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tip, setTip] = useState("");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [pickerItem, setPickerItem] = useState<Item | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const splitIdRef = useRef(1);

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

  function addLine(line: { catalog_item_id: string | null; variation_id: string | null; name: string; unit_price: number }) {
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find(
        (l) => l.catalog_item_id === line.catalog_item_id && l.variation_id === line.variation_id
      );
      if (existing) {
        return prev.map((l) =>
          l.catalog_item_id === line.catalog_item_id && l.variation_id === line.variation_id
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
        },
      ];
    });
  }

  function addItem(item: Item) {
    if (item.variations.length > 0) {
      setReceipt(null);
      setPickerItem(item);
      return;
    }
    addLine({ catalog_item_id: item.id, variation_id: null, name: item.name, unit_price: item.price });
  }

  function pickVariation(item: Item, v: Variation) {
    addLine({
      catalog_item_id: item.id,
      variation_id: v.id,
      name: item.name + " - " + v.name,
      unit_price: v.price,
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
    setCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
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
  const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((discountedSubtotal + tax + tipNum) * 100) / 100;

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
        discount_type: discountMode,
        discount_value: discountInput,
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
        discount_type: discountMode,
        discount_value: discountInput,
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
      {pickerItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPickerItem(null)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{pickerItem.name}</h3>
              <button
                type="button"
                onClick={() => setPickerItem(null)}
                className="text-xs text-muted-foreground underline"
              >
                Cancel
              </button>
            </div>
            <div className="space-y-2">
              {pickerItem.variations.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVariation(pickerItem, v)}
                  className="w-full flex items-center justify-between p-3 rounded-md border border-border hover:border-foreground/40 hover:bg-accent/50 text-left"
                >
                  <span className="text-sm font-medium">{v.name}</span>
                  <span className="text-sm tabular-nums">{"$" + v.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
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
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Clear
                    </button>
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
                            {"$" + line.unit_price.toFixed(2)}
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

                <Button className="w-full" onClick={handleComplete} disabled={pending || cart.length === 0}>
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