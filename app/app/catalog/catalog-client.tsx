"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCatalogItem,
  setCatalogItemActive,
  setCatalogItemTaxable,
  setCatalogItemTaxRate,
  createVariation,
  deleteVariation,
  createModifier,
  deleteModifier,
} from "./actions";

type Option = { id: string; name: string; price: number };
type TaxRate = { id: string; name: string; rate: number };
type Item = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
  taxable: boolean;
  tax_rate_id: string | null;
  variations: Option[];
  modifiers: Option[];
};

export function CatalogClient({ initialItems, taxRates }: { initialItems: Item[]; taxRates: TaxRate[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [varName, setVarName] = useState("");
  const [varPrice, setVarPrice] = useState("");
  const [varError, setVarError] = useState<string | null>(null);
  const [modName, setModName] = useState("");
  const [modPrice, setModPrice] = useState("");
  const [modError, setModError] = useState<string | null>(null);

  const rateNameById: Record<string, string> = {};
  for (const r of taxRates) rateNameById[r.id] = r.name;

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
        taxable,
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
          taxable: taxable,
          tax_rate_id: null,
          variations: [],
          modifiers: [],
        },
      ]);
      setName("");
      setPrice("");
      setCategory("");
      setTaxable(true);
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

  function handleToggleTaxable(item: Item) {
    startTransition(async () => {
      const res = await setCatalogItemTaxable(item.id, !item.taxable);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, taxable: !i.taxable } : i
          )
        );
      }
    });
  }

  function handleSetTaxRate(item: Item, taxRateId: string | null) {
    startTransition(async () => {
      const res = await setCatalogItemTaxRate(item.id, taxRateId);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, tax_rate_id: taxRateId } : i
          )
        );
      }
    });
  }

  function toggleExpand(itemId: string) {
    setVarName("");
    setVarPrice("");
    setVarError(null);
    setModName("");
    setModPrice("");
    setModError(null);
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

  function handleAddModifier(itemId: string) {
    setModError(null);
    if (!modName.trim()) {
      setModError("Add-on name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createModifier(
        itemId,
        modName.trim(),
        parseFloat(modPrice) || 0
      );
      if ("error" in res) {
        setModError(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                modifiers: [
                  ...i.modifiers,
                  {
                    id: res.id,
                    name: modName.trim(),
                    price: parseFloat(modPrice) || 0,
                  },
                ],
              }
            : i
        )
      );
      setModName("");
      setModPrice("");
    });
  }

  function handleDeleteModifier(itemId: string, modifierId: string) {
    startTransition(async () => {
      const res = await deleteModifier(modifierId);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  modifiers: i.modifiers.filter((m) => m.id !== modifierId),
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
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={taxable}
            onChange={(e) => setTaxable(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Taxable (apply tax at checkout)</span>
        </label>
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
              const base =
                item.variations.length > 0
                  ? item.variations.length +
                    (item.variations.length === 1 ? " variation" : " variations")
                  : "$" +
                    item.price.toFixed(2) +
                    (item.category ? " - " + item.category : "");
              const modSuffix =
                item.modifiers.length > 0
                  ? "  " +
                    "\u00b7" +
                    "  " +
                    item.modifiers.length +
                    (item.modifiers.length === 1 ? " add-on" : " add-ons")
                  : "";
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
                        {!item.taxable && (
                          <span className="ml-2 text-xs text-amber-500">Tax-free</span>
                        )}
                        {item.taxable && item.tax_rate_id && rateNameById[item.tax_rate_id] && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {rateNameById[item.tax_rate_id]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {base + modSuffix}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(item.id)}
                      >
                        {expanded ? "Done" : "Options"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleTaxable(item)}
                        disabled={pending}
                      >
                        {item.taxable ? "Taxable" : "Tax-free"}
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
                    <div className="mt-3 border-l-2 border-border space-y-4">
                      {/* Tax */}
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground pl-3">
                          Tax &mdash; which rate applies at checkout.
                        </p>
                        <div className="pl-3">
                          {item.taxable ? (
                            <select
                              value={item.tax_rate_id ?? ""}
                              onChange={(e) => handleSetTaxRate(item, e.target.value || null)}
                              disabled={pending}
                              className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm"
                            >
                              <option value="">Default rate</option>
                              {taxRates.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name + " (" + r.rate.toFixed(2) + "%)"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              This item is Tax-free. Switch it to Taxable to choose a rate.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Variations */}
                      <div className="space-y-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground pl-3">
                          Variations &mdash; options like sizes. The customer picks
                          one at checkout and its price is used.
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

                      {/* Add-ons (modifiers) */}
                      <div className="space-y-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground pl-3">
                          Add-ons &mdash; optional extras like &quot;extra shot.&quot;
                          The customer can add any number and each adds its price.
                        </p>

                        <div className="pl-3 space-y-2">
                          {item.modifiers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No add-ons yet.
                            </p>
                          ) : (
                            item.modifiers.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between"
                              >
                                <div className="text-sm">
                                  {m.name}
                                  <span className="text-muted-foreground">
                                    {"  " + "\u00b7" + "  +$" + m.price.toFixed(2)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteModifier(item.id, m.id)
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
                            <Label className="text-xs">Add-on</Label>
                            <Input
                              value={modName}
                              onChange={(e) => setModName(e.target.value)}
                              placeholder="Extra shot"
                              className="h-9 w-32"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Adds</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={modPrice}
                              onChange={(e) => setModPrice(e.target.value)}
                              placeholder="0.00"
                              className="h-9 w-24 text-right"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddModifier(item.id)}
                            disabled={pending || !modName.trim()}
                          >
                            Add
                          </Button>
                        </div>
                        {modError && (
                          <p className="text-sm text-red-600 pl-3">{modError}</p>
                        )}
                      </div>
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