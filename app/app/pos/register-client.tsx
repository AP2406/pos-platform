"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder } from "./actions";

type Item = { id: string; name: string; price: number; category: string | null };
type CartLine = {
  catalog_item_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
};
type Receipt = {
  id: string;
  businessName: string;
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
    '<div class="center">' +
    escapeHtml(r.at) +
    "</div>" +
    '<div class="center" style="font-size:10px">Ref: ' +
    escapeHtml(r.id.slice(0, 8)) +
    "</div>" +
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
    '<div class="center" style="margin-top:8px">Thank you!</div>' +
    "</body></html>";

  win.document.write(html);
  win.document.close();
  win.focus();
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
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
      const res = await createOrder({
        items: cart,
        tip: tipNum,
        payment_method: paymentMethod,
        discount_type: discountMode,
        discount_value: discountInput,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setReceipt({
        id: res.id,
        businessName,
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="bg-card border border-border rounded-lg p-4">
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
                <Button className="flex-1" onClick={() => printReceipt(receipt)}>
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
                  <span className="tabular-nums">{"$" + total.toFixed(2)}</span>
                </div>
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
  );
}