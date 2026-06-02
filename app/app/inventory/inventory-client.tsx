"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveInventorySettings, adjustStock, recordCount } from "./actions";

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

  const [scan, setScan] = useState("");

  const [track, setTrack] = useState(false);
  const [reorder, setReorder] = useState("");
  const [barcode, setBarcode] = useState("");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("receive");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function loadForm(item: Item) {
    setMsg(null);
    setErr(null);
    setChange("");
    setCounted("");
    setNote("");
    setReason("receive");
    setTrack(item.track_inventory);
    setReorder(item.reorder_point ? String(item.reorder_point) : "");
    setBarcode(item.barcode ?? "");
  }

  function toggleItem(item: Item) {
    loadForm(item);
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  }

  function openItem(item: Item) {
    loadForm(item);
    setExpandedId(item.id);
  }

  function handleScanKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    const hit = items.find((i) => i.barcode && i.barcode === code);
    if (hit) {
      openItem(hit);
      setScan("");
    }
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

  function handleCount(itemId: string) {
    setErr(null);
    setMsg(null);
    if (counted.trim() === "") {
      setErr("Enter the counted quantity.");
      return;
    }
    const c = parseFloat(counted);
    if (isNaN(c) || c < 0) {
      setErr("Counted quantity must be 0 or more.");
      return;
    }
    startTransition(async () => {
      const res = await recordCount(itemId, c, note);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, stock_qty: c } : i))
      );
      setCounted("");
      setNote("");
      const v = res.variance;
      if (v === 0) setMsg("Counted " + c + " - matches expected. No variance.");
      else if (v < 0)
        setMsg("Counted " + c + " - short by " + Math.abs(v) + " (recorded).");
      else setMsg("Counted " + c + " - over by " + v + " (recorded).");
    });
  }

  const q = scan.trim().toLowerCase();
  const visible =
    q === ""
      ? items
      : items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.barcode ? i.barcode.toLowerCase().includes(q) : false)
        );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-4">
        <Label htmlFor="scan" className="text-xs">
          Scan or search
        </Label>
        <Input
          id="scan"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={handleScanKey}
          placeholder="Scan a barcode or type a name"
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Scan with a barcode scanner to jump to an item, or type to filter the
          list.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Items ({items.length})</h2>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No items yet. Add products in the Catalog first."
              : "No matches."}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => {
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
                    <Button variant="outline" size="sm" onClick={() => toggleItem(item)}>
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
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="space-y-1">
                            <Label className="text-xs">Note (optional)</Label>
                            <Input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Applies to the next adjust or count"
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Adjust stock</Label>
                            <div className="flex flex-wrap items-end gap-2">
                              <Input
                                type="number"
                                step="1"
                                value={change}
                                onChange={(e) => setChange(e.target.value)}
                                placeholder="e.g. 10 or -2"
                                className="h-9 w-28 text-right"
                              />
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
                              <Button
                                size="sm"
                                onClick={() => handleAdjust(item.id)}
                                disabled={pending}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Cycle count</Label>
                            <p className="text-xs text-muted-foreground">
                              {"Expected " +
                                item.stock_qty +
                                ". Count the shelf and enter the actual quantity - we record the difference."}
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={counted}
                                onChange={(e) => setCounted(e.target.value)}
                                placeholder={String(item.stock_qty)}
                                className="h-9 w-28 text-right"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCount(item.id)}
                                disabled={pending}
                              >
                                Record count
                              </Button>
                            </div>
                          </div>
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