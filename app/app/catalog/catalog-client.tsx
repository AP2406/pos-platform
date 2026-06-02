"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCatalogItem,
  setCatalogItemActive,
  createVariation,
  deleteVariation,
} from "./actions";

type Variation = { id: string; name: string; price: number };
type Item = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
  variations: Variation[];
};

export function CatalogClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [varName, setVarName] = useState("");
  const [varPrice, setVarPrice] = useState("");
  const [varError, setVarError] = useState<string | null>(null);

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
          is_active: true,
          variations: [],
        },
      ]);
      setName("");
      setPrice("");
      setCategory("");
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

  function toggleExpand(itemId: string) {
    setVarName("");
    setVarPrice("");
    setVarError(null);
    setExpandedId((prev) => (prev === itemId ? null : itemId));
  }

  function handleAddVariation(itemId: string) {
    setVarError(null);
    if (!varName.trim()) {
      setVarError("Variation name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createVariation(
        itemId,
        varName.trim(),
        parseFloat(varPrice) || 0
      );
      if ("error" in res) {
        setVarError(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                variations: [
                  ...i.variations,
                  {
                    id: res.id,
                    name: varName.trim(),
                    price: parseFloat(varPrice) || 0,
                  },
                ],
              }
            : i
        )
      );
      setVarName("");
      setVarPrice("");
    });
  }

  function handleDeleteVariation(itemId: string, variationId: string) {
    startTransition(async () => {
      const res = await deleteVariation(variationId);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  variations: i.variations.filter((v) => v.id !== variationId),
                }
              : i
          )
        );
      }
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-sm font-medium mb-3">Add an item</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            {items.map((item) => {
              const expanded = expandedId === item.id;
              return (
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
                        {item.variations.length > 0
                          ? item.variations.length +
                            (item.variations.length === 1
                              ? " variation"
                              : " variations")
                          : "$" +
                            item.price.toFixed(2) +
                            (item.category ? " - " + item.category : "")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(item.id)}
                      >
                        {expanded ? "Done" : "Variations"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(item)}
                        disabled={pending}
                      >
                        {item.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 border-l-2 border-border space-y-3">
                      <p className="text-xs text-muted-foreground pl-3">
                        Options like sizes. When an item has variations, the
                        customer picks one at checkout and its price is used.
                      </p>

                      <div className="pl-3 space-y-2">
                        {item.variations.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No variations yet.
                          </p>
                        ) : (
                          item.variations.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between"
                            >
                              <div className="text-sm">
                                {v.name}
                                <span className="text-muted-foreground">
                                  {"  " + "\u00b7" + "  $" + v.price.toFixed(2)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteVariation(item.id, v.id)
                                }
                                disabled={pending}
                                className="text-xs text-muted-foreground underline hover:text-red-600"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="pl-3 flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Variation</Label>
                          <Input
                            value={varName}
                            onChange={(e) => setVarName(e.target.value)}
                            placeholder="Large"
                            className="h-9 w-32"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={varPrice}
                            onChange={(e) => setVarPrice(e.target.value)}
                            placeholder="0.00"
                            className="h-9 w-24 text-right"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddVariation(item.id)}
                          disabled={pending || !varName.trim()}
                        >
                          Add
                        </Button>
                      </div>
                      {varError && (
                        <p className="text-sm text-red-600 pl-3">{varError}</p>
                      )}
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