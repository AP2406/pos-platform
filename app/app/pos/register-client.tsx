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

export function RegisterClient({
  items,
  taxRate,
}: {
  items: Item[];
  taxRate: number;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tip, setTip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">(
    "cash"
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function addItem(item: Item) {
    setDone(false);
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
  }

  const subtotal = cart.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const tipNum = parseFloat(tip) || 0;
  const total = Math.round((subtotal + tax + tipNum) * 100) / 100;

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
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      clearCart();
      setDone(true);
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
            <p className="text-sm text-muted-foreground">
              {done ? "Sale complete. Start the next one." : "No items yet."}
            </p>
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
              <span className="tabular-nums">{"$" + subtotal.toFixed(2)}</span>
            </div>
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
              : "Complete sale" + (total > 0 ? " - $" + total.toFixed(2) : "")}
          </Button>
        </div>
      </div>
    </div>
  );
}