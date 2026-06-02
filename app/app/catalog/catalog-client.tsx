"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCatalogItem,
  setCatalogItemActive,
  setCatalogItemBarcode,
} from "./actions";

type Item = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  barcode: string | null;
  is_active: boolean;
};

export function CatalogClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBarcode, setEditBarcode] = useState("");

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createCatalogItem({
        name,
        price: parseFloat(price) || 0,
        category,
        barcode,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          id: res.id,
          name: name.trim(),
          price: parseFloat(price) || 0,
          category: category.trim() || null,
          barcode: barcode.trim() || null,
          is_active: true,
        },
      ]);
      setName("");
      setPrice("");
      setCategory("");
      setBarcode("");
    });
  }

  function handleToggleActive(item: Item) {
    startTransition(async () => {
      const res = await setCatalogItemActive(item.id, !item.is_active);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_active: !i.is_active } : i
          )
        );
      }
    });
  }

  function startEditBarcode(item: Item) {
    setEditingId(item.id);
    setEditBarcode(item.barcode || "");
  }

  function cancelEditBarcode() {
    setEditingId(null);
    setEditBarcode("");
  }

  function saveBarcode(item: Item) {
    const value = editBarcode.trim();
    startTransition(async () => {
      const res = await setCatalogItemBarcode(item.id, value);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, barcode: value || null } : i
          )
        );
        setEditingId(null);
        setEditBarcode("");
      }
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Add an item</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="item-name" className="text-xs">
              Name
            </Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Haircut"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-price" className="text-xs">
              Price
            </Label>
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-category" className="text-xs">
              Category (optional)
            </Label>
            <Input
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Services"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-barcode" className="text-xs">
              Barcode (optional)
            </Label>
            <Input
              id="item-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type"
            />
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={handleAdd} disabled={pending || !name.trim()}>
            {pending ? "Saving..." : "Add item"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No items yet. Add your first one above.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={
                        "font-medium " +
                        (item.is_active
                          ? ""
                          : "text-muted-foreground line-through")
                      }
                    >
                      {item.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {"$" +
                        item.price.toFixed(2) +
                        (item.category ? " - " + item.category : "")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(item)}
                    disabled={pending}
                  >
                    {item.is_active ? "Disable" : "Enable"}
                  </Button>
                </div>

                <div className="mt-2">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editBarcode}
                        onChange={(e) => setEditBarcode(e.target.value)}
                        placeholder="Scan or type barcode"
                        className="h-8 max-w-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => saveBarcode(item)}
                        disabled={pending}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditBarcode}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditBarcode(item)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      {item.barcode
                        ? "Barcode: " + item.barcode
                        : "Add barcode"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
