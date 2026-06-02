"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveInventorySettings, adjustStock } from "./actions";

type Item = {
  id: string;
  name: string;
  track_inventory: boolean;
  stock_qty: number;
  reorder_point: number;
  barcode: string | null;
  is_active: boolean;
};

export function InventoryClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [track, setTrack] = useState(false);
  const [reorder, setReorder] = useState("");
  const [barcode, setBarcode] = useState("");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("receive");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function openItem(item: Item) {
    setMsg(null);
    setErr(null);
    setChange("");
    setNote("");
    setReason("receive");
    setTrack(item.track_inventory);
    setReorder(item.reorder_point ? String(item.reorder_point) : "");
    setBarcode(item.barcode ?? "");
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  }

  function handleSaveSettings(itemId: string) {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const res = await saveInventorySettings(
        itemId,
        track,
        parseFloat(reorder) || 0,
        barcode.trim() || null
      );
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                track_inventory: track,
                reorder_point: parseFloat(reorder) || 0,
                barcode: barcode.trim() || null,
              }
            : i
        )
      );
      setMsg("Settings saved.");
    });
  }

  function handleAdjust(itemId: string) {
    setErr(null);
    setMsg(null);
    const chg = parseFloat(change) || 0;
    if (chg === 0) {
      setErr("Enter a non-zero amount (use a minus sign to remove stock).");
      return;
    }
    startTransition(async () => {
      const res = await adjustStock(itemId, chg, reason, note);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, stock_qty: res.new_qty } : i))
      );
      setChange("");
      setNote("");
      setMsg("Stock updated. New count: " + res.new_qty);
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet. Add products in the Catalog first.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const expanded = expandedId === item.id;
              const low = item.track_inventory && item.stock_qty <= item.reorder_point;
              return (
                <div key={item.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.track_inventory
                          ? item.stock_qty + " in stock"
                          : "Not tracked"}
                        {low && (
                          <span className="ml-2 text-red-600 font-medium">
                            Low stock
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openItem(item)}>
                      {expanded ? "Done" : "Manage"}
                    </Button>
                  </div>

                  {expanded && (
                    <div className="mt-3 border-l-2 border-border pl-3 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setTrack((t) => !t)}
                            className={
                              "px-3 py-1 text-sm rounded-md border transition-colors " +
                              (track
                                ? "border-foreground bg-accent font-medium"
                                : "border-border hover:border-foreground/40")
                            }
                          >
                            {track ? "Tracking on" : "Tracking off"}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            Tap to toggle stock tracking for this item.
                          </span>
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Low-stock at</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={reorder}
                              onChange={(e) => setReorder(e.target.value)}
                              placeholder="0"
                              className="h-9 w-24 text-right"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Barcode</Label>
                            <Input
                              value={barcode}
                              onChange={(e) => setBarcode(e.target.value)}
                              placeholder="Scan or type"
                              className="h-9 w-44"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveSettings(item.id)}
                            disabled={pending}
                          >
                            Save settings
                          </Button>
                        </div>
                      </div>

                      {track && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <Label className="text-xs">Adjust stock</Label>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Change (+/-)
                              </Label>
                              <Input
                                type="number"
                                step="1"
                                value={change}
                                onChange={(e) => setChange(e.target.value)}
                                placeholder="e.g. 10 or -2"
                                className="h-9 w-28 text-right"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">
                                Reason
                              </Label>
                              <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                              >
                                <option value="receive">Receive</option>
                                <option value="adjustment">Adjustment</option>
                                <option value="damage">Damage / loss</option>
                                <option value="initial">Initial count</option>
                              </select>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAdjust(item.id)}
                              disabled={pending}
                            >
                              Apply
                            </Button>
                          </div>
                          <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="h-9"
                          />
                        </div>
                      )}

                      {msg && <p className="text-sm text-green-600">{msg}</p>}
                      {err && <p className="text-sm text-red-600">{err}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}