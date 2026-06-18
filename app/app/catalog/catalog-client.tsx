"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_PALETTE } from "../pos/category-colors";
import {
  createCatalogItem,
  setCatalogItemActive,
  setCatalogItemTaxable,
  setCatalogItemTaxRate,
  setCatalogItemDefaultCourse,
} from "./actions";
import { setCatalogItemStation } from "../kitchen/stations-actions";
import { ModifierGroupsEditor, type ModGroup } from "./modifier-groups-editor";
import {
  setCatalogItemBarcode,
  setCatalogItemImage,
  setCatalogItemOutOfStock,
  setCatalogItemAllergens,
  saveCategoryColors,
  createVariation,
  deleteVariation,
} from "./actions";
import { ALLERGENS } from "@/lib/allergens";

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
  barcode: string | null;
  image_url: string | null;
  out_of_stock: boolean;
  out_of_stock_at?: string | null;
  allergens?: string[] | null;
  default_course_id: string | null;
  station_id: string | null;
  variations: Option[];
  modifiers: Option[];
  modifierGroups: ModGroup[];
};
type CourseOption = { id: string; name: string };
type StationOption = { id: string; name: string };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Upload an image to the public "item-images" bucket and return its public URL.
async function uploadItemImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 5MB).");
  }
  const supabase = createClient();
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  const path = crypto.randomUUID() + ext;
  const { error } = await supabase.storage
    .from("item-images")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("item-images").getPublicUrl(path);
  return data.publicUrl;
}

export function CatalogClient({
  initialItems,
  taxRates,
  initialCategoryColors,
  courses = [],
  stations = [],
}: {
  initialItems: Item[];
  taxRates: TaxRate[];
  initialCategoryColors: Record<string, string>;
  courses?: CourseOption[];
  stations?: StationOption[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [addUploading, setAddUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [varName, setVarName] = useState("");
  const [varPrice, setVarPrice] = useState("");
  const [varError, setVarError] = useState<string | null>(null);
  const [barcodeEdit, setBarcodeEdit] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [itemUploading, setItemUploading] = useState(false);
  const [itemImgError, setItemImgError] = useState<string | null>(null);

  const [categoryColors, setCategoryColors] =
    useState<Record<string, string>>(initialCategoryColors);
  const [colorError, setColorError] = useState<string | null>(null);

  const rateNameById: Record<string, string> = {};
  for (const r of taxRates) rateNameById[r.id] = r.name;

  const categoryOptions = Array.from(
    new Set(
      items
        .map((i) => (i.category || "").trim())
        .filter((c) => c.length > 0)
    )
  ).sort();

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
        barcode,
        image_url: imageUrl,
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
          barcode: barcode.trim() || null,
          image_url: imageUrl || null,
          out_of_stock: false,
          default_course_id: null,
          station_id: null,
          modifierGroups: [],
          variations: [],
          modifiers: [],
        },
      ]);
      setName("");
      setPrice("");
      setCategory("");
      setBarcode("");
      setTaxable(true);
      setImageUrl("");
    });
  }

  function handleAddImageFile(file: File | null) {
    if (!file) return;
    setError(null);
    setAddUploading(true);
    uploadItemImage(file)
      .then((url) => setImageUrl(url))
      .catch((e) => setError(e instanceof Error ? e.message : "Upload failed."))
      .finally(() => setAddUploading(false));
  }

  function handleItemImageFile(item: Item, file: File | null) {
    if (!file) return;
    setItemImgError(null);
    setItemUploading(true);
    uploadItemImage(file)
      .then((url) => {
        startTransition(async () => {
          const res = await setCatalogItemImage(item.id, url);
          if ("error" in res) {
            setItemImgError(res.error);
            return;
          }
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, image_url: url } : i))
          );
        });
      })
      .catch((e) =>
        setItemImgError(e instanceof Error ? e.message : "Upload failed.")
      )
      .finally(() => setItemUploading(false));
  }

  function handleItemImageRemove(item: Item) {
    setItemImgError(null);
    startTransition(async () => {
      const res = await setCatalogItemImage(item.id, null);
      if ("error" in res) {
        setItemImgError(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, image_url: null } : i))
      );
    });
  }

  function handleSetCategoryColor(cat: string, key: string) {
    setColorError(null);
    const next = { ...categoryColors };
    if (next[cat] === key) {
      delete next[cat];
    } else {
      next[cat] = key;
    }
    setCategoryColors(next);
    startTransition(async () => {
      const res = await saveCategoryColors(next);
      if ("error" in res) {
        setColorError(res.error);
        setCategoryColors(categoryColors);
      }
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

  function handleToggleOos(item: Item) {
    startTransition(async () => {
      const next = !item.out_of_stock;
      const res = await setCatalogItemOutOfStock(item.id, next);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, out_of_stock: next, out_of_stock_at: next ? res.at : null }
              : i
          )
        );
      }
    });
  }

  function toggleAllergen(item: Item, key: string) {
    const current = item.allergens ?? [];
    const next = current.includes(key)
      ? current.filter((a) => a !== key)
      : [...current, key];
    startTransition(async () => {
      const res = await setCatalogItemAllergens(item.id, next);
      if (!("error" in res)) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, allergens: next } : i)));
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

  function handleSetDefaultCourse(item: Item, courseId: string | null) {
    startTransition(async () => {
      const res = await setCatalogItemDefaultCourse(item.id, courseId);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, default_course_id: courseId } : i))
        );
      }
    });
  }

  function handleSetStation(item: Item, stationId: string | null) {
    startTransition(async () => {
      const res = await setCatalogItemStation(item.id, stationId);
      if (!("error" in res)) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, station_id: stationId } : i))
        );
      }
    });
  }

  function toggleExpand(item: Item) {
    setVarName("");
    setVarPrice("");
    setVarError(null);
    setBarcodeError(null);
    setBarcodeEdit(expandedId === item.id ? "" : (item.barcode ?? ""));
    setExpandedId((prev) => (prev === item.id ? null : item.id));
  }

  function handleSaveBarcode(itemId: string) {
    setBarcodeError(null);
    startTransition(async () => {
      const clean = barcodeEdit.trim();
      const res = await setCatalogItemBarcode(itemId, clean.length > 0 ? clean : null);
      if ("error" in res) {
        setBarcodeError(res.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, barcode: clean.length > 0 ? clean : null } : i
        )
      );
    });
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
              list="catalog-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Services"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-barcode" className="text-xs">
              Barcode / code (optional)
            </Label>
            <Input
              id="item-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type"
            />
          </div>
        </div>
        <datalist id="catalog-categories">
          {categoryOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={taxable}
            onChange={(e) => setTaxable(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Taxable (apply tax at checkout)</span>
        </label>

        <div className="mt-3 space-y-1">
          <Label className="text-xs">Photo (optional)</Label>
          <div className="flex items-center gap-3">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Item preview"
                className="h-16 w-16 rounded-md object-cover border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                None
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                {addUploading ? "Uploading..." : imageUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={addUploading}
                  onChange={(e) => {
                    handleAddImageFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Button onClick={handleAdd} disabled={pending || addUploading || !name.trim()}>
            {pending ? "Saving..." : "Add item"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {categoryOptions.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-sm font-medium mb-1">Category colors</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Pick a color for each category. It color-codes the register tiles (for
            items without a photo).
          </p>
          <div className="space-y-3">
            {categoryOptions.map((cat) => (
              <div key={cat} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium truncate">{cat}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {CATEGORY_PALETTE.map((p) => {
                    const selected = categoryColors[cat] === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        title={p.label}
                        aria-label={cat + " " + p.label}
                        onClick={() => handleSetCategoryColor(cat, p.key)}
                        disabled={pending}
                        className={
                          "h-6 w-6 rounded-full " +
                          p.swatch +
                          " transition-transform hover:scale-110 " +
                          (selected
                            ? "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                            : "")
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {colorError && (
            <p className="text-sm text-red-600 mt-2">{colorError}</p>
          )}
        </div>
      )}

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
              const codeSuffix = item.barcode
                ? "  " + "\u00b7" + "  Code " + item.barcode
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
                        {item.out_of_stock && (
                          <span className="ml-2 text-xs text-red-600 font-semibold">
                            {"86'd" + (item.out_of_stock_at ? " · " + new Date(item.out_of_stock_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "")}
                          </span>
                        )}
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
                        {base + modSuffix + codeSuffix}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(item)}
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
                        onClick={() => handleToggleOos(item)}
                        disabled={pending}
                      >
                        {item.out_of_stock ? "Restock" : "86"}
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

                      {courses.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground pl-3">
                            Course &mdash; which course this item fires with on a table (full-service).
                          </p>
                          <div className="pl-3">
                            <select
                              value={item.default_course_id ?? ""}
                              onChange={(e) => handleSetDefaultCourse(item, e.target.value || null)}
                              disabled={pending}
                              className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm"
                            >
                              <option value="">First course</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {stations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground pl-3">
                            Prep station &mdash; which kitchen screen this item prints to when fired (full-service).
                          </p>
                          <div className="pl-3">
                            <select
                              value={item.station_id ?? ""}
                              onChange={(e) => handleSetStation(item, e.target.value || null)}
                              disabled={pending}
                              className="h-9 rounded-md border border-border bg-transparent text-foreground px-2 text-sm"
                            >
                              <option value="">No station</option>
                              {stations.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Allergens */}
                      <div className="space-y-2 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground pl-3">
                          Allergens &mdash; shown bold red on the kitchen screen and printed chit when this item is fired.
                        </p>
                        <div className="pl-3 flex flex-wrap gap-x-4 gap-y-1.5">
                          {ALLERGENS.map((a) => (
                            <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={(item.allergens ?? []).includes(a.key)}
                                onChange={() => toggleAllergen(item, a.key)}
                                disabled={pending}
                                className="h-4 w-4"
                              />
                              {a.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Code / barcode */}
                      <div className="space-y-2 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground pl-3">
                          Code &mdash; barcode or SKU used to find this item at the register.
                        </p>
                        <div className="pl-3 flex flex-wrap items-end gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Barcode / code</Label>
                            <Input
                              value={barcodeEdit}
                              onChange={(e) => setBarcodeEdit(e.target.value)}
                              placeholder="Scan or type"
                              className="h-9 w-44"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveBarcode(item.id)}
                            disabled={pending}
                          >
                            Save
                          </Button>
                        </div>
                        {barcodeError && (
                          <p className="text-sm text-red-600 pl-3">{barcodeError}</p>
                        )}
                      </div>

                      {/* Photo */}
                      <div className="space-y-2 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground pl-3">
                          Photo &mdash; optional image shown on the register tile.
                        </p>
                        <div className="pl-3 flex items-center gap-3">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-16 w-16 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                              None
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
                              {itemUploading
                                ? "Uploading..."
                                : item.image_url
                                ? "Replace"
                                : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={itemUploading || pending}
                                onChange={(e) => {
                                  handleItemImageFile(item, e.target.files?.[0] ?? null);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {item.image_url && (
                              <button
                                type="button"
                                onClick={() => handleItemImageRemove(item)}
                                disabled={pending || itemUploading}
                                className="text-xs text-muted-foreground underline hover:text-red-600"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        {itemImgError && (
                          <p className="text-sm text-red-600 pl-3">{itemImgError}</p>
                        )}
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

                      {/* Modifier groups (P0-2) */}
                      <ModifierGroupsEditor itemId={item.id} initial={item.modifierGroups} />
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