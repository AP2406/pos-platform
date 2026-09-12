"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addLineItem, deleteLineItem } from "./line-item-actions";

type LineItem = {
  id: string;
  name: string;
  amount: number;
  quantity: number;
  category: string | null;
};

export function LineItemsSection({
  tripId,
  items,
  canEdit,
}: {
  tripId: string;
  items: LineItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );

  function resetForm() {
    setName("");
    setAmount("");
    setQuantity("1");
    setError(null);
  }

  function handleAdd() {
    setError(null);
    const parsedAmount = parseFloat(amount);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    const parsedQty = parseInt(quantity, 10) || 1;

    startTransition(async () => {
      const result = await addLineItem({
        tripId,
        name: name.trim(),
        amount: parsedAmount,
        quantity: parsedQty,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        resetForm();
        setAdding(false);
        router.refresh();
      }
    });
  }

  function handleDelete(itemId: string) {
    if (!confirm("Remove this line item?")) return;
    startTransition(async () => {
      const result = await deleteLineItem({ id: itemId, tripId });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">
        Line items
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No add-ons yet (tolls, child seats, wait time, etc.)
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {item.name}
                  {item.quantity > 1 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                {item.category && (
                  <div className="text-xs text-muted-foreground">
                    {item.category}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium tabular-nums">
                  ${(item.amount * item.quantity).toFixed(2)}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Add-ons subtotal
            </div>
            <div className="text-sm font-medium tabular-nums">
              ${subtotal.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <>
          {!adding ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
              disabled={isPending}
            >
              + Add line item
            </Button>
          ) : (
            <div className="space-y-2 border border-border rounded-md p-3 bg-muted/30">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Description
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 407 toll, child seat, wait time"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    autoFocus
                  />
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1 tabular-nums"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1 tabular-nums"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleAdd} disabled={isPending}>
                  {isPending ? "Adding…" : "Add"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAdding(false);
                    resetForm();
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}