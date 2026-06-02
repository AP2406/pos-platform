"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder, searchCustomers, quickCreateCustomer } from "./actions";
import { BarcodeScanner } from "./barcode-scanner";

type Item = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  barcode: string | null;
};
type CartLine = {
  catalog_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
};
type Customer = { id: string; name: string };
type Receipt = {
  id: string;
  businessName: string;
  customerName: string | null;
  items: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
  paymentMethod: string;
  at: string;
};

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

  const customerLine = r.customerName
    ? '<div class="center" style="font-size:11px">Customer: ' +
      escapeHtml(r.customerName) +
      "</div>"
    : "";

  const html =
    "<html><head><title>Receipt</title><style>" +
    "@page{size:80mm auto;margin:0}" +
    "*{margin:0;padding:0;box-sizing:border-box}" +
    "body{font-family:'Courier New',monospace;font-size:12px;line-height:1.35;width:80mm;padding:4mm 5mm;color:#000}" +
    "h2{text-align:center;font-size:15px;margin-bottom:2px}" +
    "table{width:100%;border-collapse:collapse}" +
    "td{padding:1px 0;vertical-align:top}" +
    ".line{border-top:1px dashed #000;margin:5px 0}" +
    ".tot td{font-weight:bold;font-size:13px}" +
    ".center{text-align:center}" +
    "</style></head><body>" +
    "<h2>" +
    escapeHtml(r.businessName) +
    "</h2>" +
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
    '<div class="center">Paid: ' +
    escapeHtml(r.paymentMethod) +
    "</div>" +
    '<div class="center" style="margin-top:10px">Thank you!</div>' +
    '<div class="center" style="margin-top:6px;font-size:18px">.</div>' +
    "</body></html>";

  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = function () {
    win.close();
  };
  win.print();
}

export function RegisterClient({
  items,
  taxRate,
  businessName,
}: {
  items: Item[];
  taxRate: number;
  businessName: string;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tip, setTip] = useState("");
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">(
    "amount"
  );
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">(
    "cash"
  );
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Keep latest items available to the scanner listener without re-binding it.
  const itemsRef = useRef(items);
  itemsRef.current = items;

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

  // Hardware barcode scanner support (USB/Bluetooth scanners type fast + Enter).
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;

    function handleScan(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }

      const now = Date.now();
      if (now - lastKeyTime > 100) {
        buffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.length >= 3) {
          handleScannedCode(buffer);
        }
        buffer = "";
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", handleScan);
    return () => window.removeEventListener("keydown", handleScan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear the scan message after a moment.
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 2000);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  function handleScannedCode(code: string) {
    const match = itemsRef.current.find((it) => it.barcode === code);
    if (match) {
      addItem(match);
      setScanFeedback("Added: " + match.name);
    } else {
      setScanFeedback("No item for barcode " + code);
    }
  }

  function handleCameraDetected(code: string) {
    setScanning(false);
    handleScannedCode(code);
  }

  function addItem(item: Item) {
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.catalog_item_id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.catalog_item_id === item.id
            ? { ...l, quantity: l.quantity + 1 }
            : l
        );
      }
      return [
        ...prev,
        {
          catalog_item_id: item.id,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
        },
      ];
    });
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
  let discount =
    discountMode === "percent"
      ? subtotal * (discountInput / 100)
      : discountInput;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  discount = Math.round(discount * 100) / 100;

  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  const tax = Math.round(discountedSubtotal * taxRate * 100) / 100;
  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((discountedSubtotal + tax + tipNum) * 100) / 100;

  function handleComplete() {
    setError(null);
    if (cart.length === 0) {
      setError("Add at least one item.");
      return;
    }
    const attachedCustomer = customer;
    startTransition(async () => {
      const res = await createOrder({
        items: cart,
        tip: tipNum,
        payment_method: paymentMethod,
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
        businessName,
        customerName: attachedCustomer ? attachedCustomer.name : null,
        items: cart,
        subtotal,
        discount,
        tax,
        tip: tipNum,
        total,
        paymentMethod,
        at: new Date().toLocaleString(),
      });
      clearCart();
    });
  }

  return (
    <>
      {scanning && (
        <BarcodeScanner
          onDetected={handleCameraDetected}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-sm">Items</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setScanning(true)}
              >
                Scan barcode
              </Button>
            </div>

            {scanFeedback && (
              <div className="mb-3 text-xs px-3 py-2 rounded-md bg-accent text-foreground">
                {scanFeedback}
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                No items yet. Add some in the Catalog first.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    className="text-left p-3 rounded-md border border-border hover:border-foreground/40 hover:bg-accent/50 transition-colors"
                  >
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {"$" + item.price.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            {cart.length === 0 && receipt ? (
              <div className="space-y-3">
                <h2 className="font-medium">Sale complete</h2>
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
                    <span className="tabular-nums">
                      {"$" + receipt.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => printReceipt(receipt)}
                  >
                    Print receipt
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setReceipt(null)}
                  >
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
                      <div
                        key={index}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {line.name}
                          </div>
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
                          <span className="w-6 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
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
                    <span className="tabular-nums">
                      {"$" + subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Discount</span>
                    <div className="flex items-center gap-1">
                      <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => setDiscountMode("amount")}
                          className={
                            "px-2 py-1 " +
                            (discountMode === "amount"
                              ? "bg-accent font-medium"
                              : "hover:bg-accent/50")
                          }
                        >
                          $
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountMode("percent")}
                          className={
                            "px-2 py-1 border-l border-border " +
                            (discountMode === "percent"
                              ? "bg-accent font-medium"
                              : "hover:bg-accent/50")
                          }
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
                      <span className="text-muted-foreground">
                        Discount applied
                      </span>
                      <span className="tabular-nums text-red-600">
                        {"-$" + discount.toFixed(2)}
                      </span>
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
                    <span className="tabular-nums">
                      {"$" + total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Customer (optional)</Label>
                  {customer ? (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm font-medium truncate">
                        {customer.name}
                      </span>
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
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              Searching...
                            </div>
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
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No matches.
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={handleCreateCustomer}
                            disabled={addingCustomer}
                            className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-accent"
                          >
                            {addingCustomer
                              ? "Adding..."
                              : 'Add new customer "' +
                                customerQuery.trim() +
                                '"'}
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
                        className={
                          "px-2 py-2 text-sm rounded-md border transition-colors " +
                          (paymentMethod === m
                            ? "border-foreground bg-accent font-medium"
                            : "border-border hover:border-foreground/40")
                        }
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button
                  className="w-full"
                  onClick={handleComplete}
                  disabled={pending || cart.length === 0}
                >
                  {pending
                    ? "Recording..."
                    : "Complete sale" +
                      (total > 0 ? " - $" + total.toFixed(2) : "")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}