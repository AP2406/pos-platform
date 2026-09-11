"use client";

import { useState, useTransition } from "react";
import { ImageIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { ALLERGENS } from "@/lib/allergens";
import { ModifierGroupsEditor } from "./modifier-groups-editor";
import {
  createCatalogItem,
  updateCatalogItem,
  setCatalogItemActive,
  setCatalogItemOutOfStock,
  setCatalogItemTaxable,
  setCatalogItemTaxes,
  setCatalogItemBarcode,
  setCatalogItemImage,
  setCatalogItemAllergens,
  setCatalogItemPrepMinutes,
  setCatalogItemDefaultCourse,
  createVariation,
  deleteVariation,
} from "./actions";
import { setCatalogItemStation } from "../kitchen/stations-actions";
import type { AvailabilityWindow } from "../settings/availability-actions";
import {
  money,
  summarizeWindow,
  windowsForItem,
  type CourseOption,
  type Item,
  type StationOption,
  type TaxRate,
} from "./item-model";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Upload an image to the public "item-images" bucket and return its public URL.
// Unchanged from the previous catalog client — same bucket, same limits, same
// storage policies (supabase/migrations/0001_register_photos_categories.sql).
async function uploadItemImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 5MB).");
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

/** A photo well that says "no photo" without implying photos are unavailable. */
function PhotoWell({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      // Storage-bucket URLs on an arbitrary Supabase project host: next/image
      // would need every merchant's hostname in next.config remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="size-20 shrink-0 rounded-lg object-cover ring-1 ring-line"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-raised ring-1 ring-line-soft [&_svg]:size-6 [&_svg]:text-muted-foreground/50"
    >
      <ImageIcon />
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

/** A labelled switch row — the "Available for sale" pattern, reused. */
function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="u-focus mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
    </div>
  );
}

type Props = {
  /** "new" has no row yet, so only Details exists until it is saved. */
  mode: "new" | "edit";
  item: Item | null;
  allItems: Item[];
  categoryOptions: string[];
  taxRates: TaxRate[];
  courses: CourseOption[];
  stations: StationOption[];
  currency: string;
  windows: AvailabilityWindow[];
  onPatch: (id: string, patch: Partial<Item>) => void;
  onCreated: (item: Item) => void;
  onClose: () => void;
};

export function ItemEditor({
  mode,
  item,
  allItems,
  categoryOptions,
  taxRates,
  courses,
  stations,
  currency,
  windows,
  onPatch,
  onCreated,
  onClose,
}: Props) {
  // Draft state for the batched fields. The parent remounts this component with
  // a fresh `key` whenever the selection changes, so there is no effect syncing
  // props into state and no window where the form shows the previous item.
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [salesCategory, setSalesCategory] = useState(item?.sales_category ?? "");
  const [shortName, setShortName] = useState(item?.short_name ?? "");
  const [openPrice, setOpenPrice] = useState(item?.open_price ?? false);
  const [reqApproval, setReqApproval] = useState(item?.requires_manager_approval ?? false);
  const [allowReturns, setAllowReturns] = useState(item?.allow_returns ?? false);
  const [printSeparate, setPrintSeparate] = useState(item?.print_separate_ticket ?? false);
  const [showRegisterFlags, setShowRegisterFlags] = useState(false);

  // Not batched: barcode keeps its own action because that action is the only
  // thing that runs the cross-item duplicate check (actions.ts:290). Routing it
  // through updateCatalogItem would silently drop that guard.
  const [barcode, setBarcode] = useState(item?.barcode ?? "");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // New-item only: taxable and the photo are chosen before the row exists.
  const [newTaxable, setNewTaxable] = useState(true);
  const [draftImage, setDraftImage] = useState<string | null>(null);

  const [varName, setVarName] = useState("");
  const [varPrice, setVarPrice] = useState("");
  const [varError, setVarError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isNew = mode === "new" || item === null;
  const photo = isNew ? draftImage : item?.image_url ?? null;
  const busy = pending || uploading;

  const dirty =
    !!item &&
    (name !== item.name ||
      price !== String(item.price) ||
      category !== (item.category ?? "") ||
      salesCategory !== (item.sales_category ?? "") ||
      shortName !== (item.short_name ?? "") ||
      openPrice !== item.open_price ||
      reqApproval !== item.requires_manager_approval ||
      allowReturns !== item.allow_returns ||
      printSeparate !== item.print_separate_ticket);

  function resetDraft() {
    if (!item) {
      onClose();
      return;
    }
    setName(item.name);
    setPrice(String(item.price));
    setCategory(item.category ?? "");
    setSalesCategory(item.sales_category ?? "");
    setShortName(item.short_name ?? "");
    setOpenPrice(item.open_price);
    setReqApproval(item.requires_manager_approval);
    setAllowReturns(item.allow_returns);
    setPrintSeparate(item.print_separate_ticket);
    setError(null);
  }

  function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    const numericPrice = parseFloat(price) || 0;

    startTransition(async () => {
      if (isNew) {
        // createCatalogItem → authorizeAction("edit_menu", { configWrite: true })
        const res = await createCatalogItem({
          name: trimmed,
          price: numericPrice,
          category,
          taxable: newTaxable,
          barcode,
          image_url: draftImage ?? "",
          sales_category: salesCategory,
          short_name: shortName,
          open_price: openPrice,
          requires_manager_approval: reqApproval,
          allow_returns: allowReturns,
          print_separate_ticket: printSeparate,
        });
        if ("error" in res) {
          setError(res.error);
          return;
        }
        onCreated({
          id: res.id,
          name: trimmed,
          price: numericPrice,
          category: category.trim() || null,
          is_active: true,
          taxable: newTaxable,
          tax_rate_id: null,
          tax_rate_ids: [],
          barcode: barcode.trim() || null,
          image_url: draftImage,
          out_of_stock: false,
          out_of_stock_at: null,
          allergens: [],
          prep_minutes: null,
          default_course_id: null,
          station_id: null,
          sales_category: salesCategory.trim() || null,
          short_name: shortName.trim() || null,
          open_price: openPrice,
          requires_manager_approval: reqApproval,
          allow_returns: allowReturns,
          print_separate_ticket: printSeparate,
          variations: [],
          modifiers: [],
          modifierGroups: [],
        });
        return;
      }

      if (!item) return;
      // updateCatalogItem → authorizeAction("edit_menu", { configWrite: true }).
      // barcode / image_url / taxable are deliberately absent: each is patched
      // only when present, so leaving them out preserves their own actions'
      // validation rather than round-tripping it.
      const res = await updateCatalogItem(item.id, {
        name: trimmed,
        price: numericPrice,
        category,
        sales_category: salesCategory,
        short_name: shortName,
        open_price: openPrice,
        requires_manager_approval: reqApproval,
        allow_returns: allowReturns,
        print_separate_ticket: printSeparate,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onPatch(item.id, {
        name: trimmed,
        price: numericPrice,
        category: category.trim() || null,
        sales_category: salesCategory.trim() || null,
        short_name: shortName.trim() || null,
        open_price: openPrice,
        requires_manager_approval: reqApproval,
        allow_returns: allowReturns,
        print_separate_ticket: printSeparate,
      });
    });
  }

  function handlePhoto(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    uploadItemImage(file)
      .then((url) => {
        if (isNew || !item) {
          setDraftImage(url);
          return;
        }
        startTransition(async () => {
          const res = await setCatalogItemImage(item.id, url);
          if ("error" in res) {
            setError(res.error);
            return;
          }
          onPatch(item.id, { image_url: url });
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Upload failed."))
      .finally(() => setUploading(false));
  }

  function removePhoto() {
    if (isNew || !item) {
      setDraftImage(null);
      return;
    }
    startTransition(async () => {
      const res = await setCatalogItemImage(item.id, null);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onPatch(item.id, { image_url: null });
    });
  }

  function saveBarcode() {
    if (!item) return;
    setBarcodeError(null);
    const clean = barcode.trim();
    startTransition(async () => {
      const res = await setCatalogItemBarcode(item.id, clean.length > 0 ? clean : null);
      if ("error" in res) {
        setBarcodeError(res.error);
        return;
      }
      onPatch(item.id, { barcode: clean.length > 0 ? clean : null });
    });
  }

  function toggleActive(next: boolean) {
    if (!item) return;
    startTransition(async () => {
      const res = await setCatalogItemActive(item.id, next);
      if (!("error" in res)) onPatch(item.id, { is_active: next });
      else setError(res.error);
    });
  }

  function toggleInStock(inStock: boolean) {
    if (!item) return;
    startTransition(async () => {
      const res = await setCatalogItemOutOfStock(item.id, !inStock);
      if (!("error" in res)) {
        onPatch(item.id, { out_of_stock: !inStock, out_of_stock_at: inStock ? null : res.at });
      } else setError(res.error);
    });
  }

  function toggleTaxable(next: boolean) {
    if (!item) return;
    startTransition(async () => {
      const res = await setCatalogItemTaxable(item.id, next);
      if (!("error" in res)) onPatch(item.id, { taxable: next });
      else setError(res.error);
    });
  }

  function toggleTax(rateId: string) {
    if (!item) return;
    const before = item.tax_rate_ids;
    const next = before.includes(rateId)
      ? before.filter((x) => x !== rateId)
      : [...before, rateId];
    onPatch(item.id, { tax_rate_ids: next });
    startTransition(async () => {
      const res = await setCatalogItemTaxes(item.id, next);
      if ("error" in res) {
        onPatch(item.id, { tax_rate_ids: before }); // revert
        setError(res.error);
      }
    });
  }

  function toggleAllergen(key: string) {
    if (!item) return;
    const current = item.allergens ?? [];
    const next = current.includes(key)
      ? current.filter((a) => a !== key)
      : [...current, key];
    startTransition(async () => {
      const res = await setCatalogItemAllergens(item.id, next);
      if (!("error" in res)) onPatch(item.id, { allergens: next });
      else setError(res.error);
    });
  }

  function savePrep(raw: string) {
    if (!item) return;
    const v = raw.trim() === "" ? null : Number(raw);
    const normalized = v && v > 0 ? v : null;
    if ((item.prep_minutes ?? null) === normalized) return;
    startTransition(async () => {
      const res = await setCatalogItemPrepMinutes(item.id, v);
      if (!("error" in res)) onPatch(item.id, { prep_minutes: normalized });
      else setError(res.error);
    });
  }

  function saveCourse(courseId: string | null) {
    if (!item) return;
    startTransition(async () => {
      const res = await setCatalogItemDefaultCourse(item.id, courseId);
      if (!("error" in res)) onPatch(item.id, { default_course_id: courseId });
      else setError(res.error);
    });
  }

  function saveStation(stationId: string | null) {
    if (!item) return;
    startTransition(async () => {
      const res = await setCatalogItemStation(item.id, stationId);
      if (!("error" in res)) onPatch(item.id, { station_id: stationId });
      else setError(res.error);
    });
  }

  function addVariation() {
    if (!item) return;
    setVarError(null);
    const n = varName.trim();
    if (!n) {
      setVarError("Variation name is required.");
      return;
    }
    const p = parseFloat(varPrice) || 0;
    startTransition(async () => {
      const res = await createVariation(item.id, n, p);
      if ("error" in res) {
        setVarError(res.error);
        return;
      }
      onPatch(item.id, { variations: [...item.variations, { id: res.id, name: n, price: p }] });
      setVarName("");
      setVarPrice("");
    });
  }

  function removeVariation(variationId: string) {
    if (!item) return;
    startTransition(async () => {
      const res = await deleteVariation(variationId);
      if (!("error" in res)) {
        onPatch(item.id, { variations: item.variations.filter((v) => v.id !== variationId) });
      }
    });
  }

  const itemWindows = item ? windowsForItem(windows, item) : [];

  const photoBlock = (
    <div className="flex items-center gap-4">
      <PhotoWell src={photo} alt={item?.name ?? "New item"} />
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={
              "u-tx u-focus inline-flex h-7 cursor-pointer items-center rounded-[min(var(--radius-md),12px)] bg-card px-2.5 text-[0.8rem] font-medium ring-1 ring-line shadow-elevation-sm hover:bg-raised hover:ring-line-strong " +
              (busy ? "pointer-events-none opacity-50" : "")
            }
          >
            {uploading ? "Uploading…" : photo ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                handlePhoto(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          {photo && (
            <Button variant="ghost" size="sm" onClick={removePhoto} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Optional. Shown on the register tile in place of the category colour.
        </p>
      </div>
    </div>
  );

  const detailsFields = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ed-name" className="text-xs text-muted-foreground">
          Name
        </Label>
        <Input
          id="ed-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Cheeseburger"
          className="h-9"
        />
      </div>

      <FieldRow>
        <div className="space-y-1.5">
          <Label htmlFor="ed-price" className="text-xs text-muted-foreground">
            {"Price (" + currency + ")"}
          </Label>
          <Input
            id="ed-price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="h-9 text-right"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <Input
            id="ed-category"
            list="menu-builder-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Mains"
            className="h-9"
          />
          <datalist id="menu-builder-categories">
            {categoryOptions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </FieldRow>

      <FieldRow>
        <div className="space-y-1.5">
          <Label htmlFor="ed-short" className="text-xs text-muted-foreground">
            Short name (kitchen)
          </Label>
          <Input
            id="ed-short"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="Chz Brgr"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ed-sales-cat" className="text-xs text-muted-foreground">
            Sales category (reporting)
          </Label>
          <Input
            id="ed-sales-cat"
            value={salesCategory}
            onChange={(e) => setSalesCategory(e.target.value)}
            placeholder="Food"
            className="h-9"
          />
        </div>
      </FieldRow>

      <div>
        <button
          type="button"
          onClick={() => setShowRegisterFlags((v) => !v)}
          aria-expanded={showRegisterFlags}
          className="u-focus rounded text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {showRegisterFlags ? "Hide register behaviour" : "Register behaviour"}
        </button>
        {showRegisterFlags && (
          <div className="mt-2 divide-y divide-line-soft rounded-lg bg-raised px-3 ring-1 ring-line-soft">
            <ToggleRow
              id="ed-open-price"
              label="Open price"
              hint="The cashier is asked for the amount at the register."
              checked={openPrice}
              onChange={setOpenPrice}
            />
            <ToggleRow
              id="ed-approval"
              label="Requires manager approval"
              hint="A manager has to authorise this item before it is rung."
              checked={reqApproval}
              onChange={setReqApproval}
            />
            <ToggleRow
              id="ed-returns"
              label="Allows returns"
              hint="Can be rung at a negative price."
              checked={allowReturns}
              onChange={setAllowReturns}
            />
            <ToggleRow
              id="ed-sep-ticket"
              label="Prints a separate ticket"
              hint="Fires on its own chit rather than with the rest of the order."
              checked={printSeparate}
              onChange={setPrintSeparate}
            />
          </div>
        )}
      </div>
    </div>
  );

  // ---- new item -----------------------------------------------------------
  if (isNew) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight">New item</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Modifiers and availability open up once it is saved.
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {photoBlock}
          {detailsFields}
          <div className="divide-y divide-line-soft rounded-lg bg-raised px-3 ring-1 ring-line-soft">
            <ToggleRow
              id="ed-new-taxable"
              label="Taxable"
              hint="Tax is applied to this item at checkout."
              checked={newTaxable}
              onChange={setNewTaxable}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-new-barcode" className="text-xs text-muted-foreground">
              Barcode / code
            </Label>
            <Input
              id="ed-new-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type"
              className="h-9"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="ghost" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={busy || !name.trim()}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Add item
          </Button>
        </div>
      </div>
    );
  }

  // ---- existing item ------------------------------------------------------
  if (!item) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">{item.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {money(item.price)}
            {item.category ? " · " + item.category : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close the editor"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </Button>
      </div>

      <Tabs defaultValue="details" className="min-h-0 flex-1">
        <TabsList className="px-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
          <TabsTrigger value="visibility">Visibility</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {photoBlock}
          {detailsFields}

          <div className="space-y-1.5">
            <Label htmlFor="ed-barcode" className="text-xs text-muted-foreground">
              Barcode / code
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="ed-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or type"
                className="h-9"
              />
              <Button
                variant="subtle"
                size="lg"
                onClick={saveBarcode}
                disabled={busy || barcode.trim() === (item.barcode ?? "")}
              >
                Save code
              </Button>
            </div>
            {barcodeError && (
              <p role="alert" className="text-xs text-destructive">
                {barcodeError}
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-line-soft pt-4">
            <h3 className="text-[13px] font-medium">Kitchen</h3>

            <div className="space-y-1.5">
              <Label htmlFor="ed-prep" className="text-xs text-muted-foreground">
                Prep time (minutes)
              </Label>
              <Input
                id="ed-prep"
                type="number"
                min="0"
                max="240"
                defaultValue={item.prep_minutes ?? ""}
                onBlur={(e) => savePrep(e.target.value)}
                disabled={busy}
                className="h-9 w-28"
                placeholder="default"
              />
              <p className="text-xs text-muted-foreground">
                The kitchen screen turns amber at the target and red at 1.5× it.
              </p>
            </div>

            {courses.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-course" className="text-xs text-muted-foreground">
                  Fires with course
                </Label>
                <select
                  id="ed-course"
                  value={item.default_course_id ?? ""}
                  onChange={(e) => saveCourse(e.target.value || null)}
                  disabled={busy}
                  className="u-focus h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">First course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {stations.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ed-station" className="text-xs text-muted-foreground">
                  Prep station
                </Label>
                <select
                  id="ed-station"
                  value={item.station_id ?? ""}
                  onChange={(e) => saveStation(e.target.value || null)}
                  disabled={busy}
                  className="u-focus h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">No station</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <fieldset className="space-y-1.5">
              <legend className="text-xs text-muted-foreground">Allergens</legend>
              <p className="text-xs text-muted-foreground">
                Printed bold red on the kitchen screen and the chit.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                {ALLERGENS.map((a) => (
                  <label
                    key={a.key}
                    className="flex cursor-pointer items-center gap-2 text-sm select-none"
                  >
                    <input
                      type="checkbox"
                      checked={(item.allergens ?? []).includes(a.key)}
                      onChange={() => toggleAllergen(a.key)}
                      disabled={busy}
                      className="u-focus size-4 accent-[var(--primary)]"
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </TabsContent>

        <TabsContent value="modifiers" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <div>
              <h3 className="text-[13px] font-medium">Variations</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sizes and the like. The guest picks one and its price is used instead
                of the item&rsquo;s.
              </p>
            </div>
            {item.variations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No variations yet.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {item.variations.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate text-sm">
                      {v.name}
                      <span className="text-muted-foreground">{" · " + money(v.price)}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => removeVariation(v.id)}
                      disabled={busy}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="ed-var-name" className="text-xs text-muted-foreground">
                  Variation
                </Label>
                <Input
                  id="ed-var-name"
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  placeholder="Large"
                  className="h-9 w-32"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-var-price" className="text-xs text-muted-foreground">
                  Price
                </Label>
                <Input
                  id="ed-var-price"
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
                variant="subtle"
                size="lg"
                onClick={addVariation}
                disabled={busy || !varName.trim()}
              >
                Add
              </Button>
            </div>
            {varError && (
              <p role="alert" className="text-sm text-destructive">
                {varError}
              </p>
            )}
          </section>

          {/* Groups are per item in the schema (catalog_modifier_groups.catalog_item_id
              is NOT NULL), which is precisely why they are edited here and not on a
              top-level "Modifier groups" tab: there is no shared library to list. */}
          <ModifierGroupsEditor
            itemId={item.id}
            initial={item.modifierGroups}
            catalogItems={allItems.map((i) => ({ id: i.id, name: i.name, price: i.price }))}
          />
        </TabsContent>

        <TabsContent value="visibility" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="divide-y divide-line-soft rounded-lg bg-raised px-3 ring-1 ring-line-soft">
            <ToggleRow
              id="ed-active"
              label="Available for sale"
              hint="Off hides it from the register and every customer menu."
              checked={item.is_active}
              disabled={busy}
              onChange={toggleActive}
            />
            <ToggleRow
              id="ed-stock"
              label="In stock"
              hint={
                item.out_of_stock && item.out_of_stock_at
                  ? "Sold out since " +
                    new Date(item.out_of_stock_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Turning this off 86s the item and tells any connected delivery platform."
              }
              checked={!item.out_of_stock}
              disabled={busy}
              onChange={toggleInStock}
            />
            <ToggleRow
              id="ed-taxable"
              label="Taxable"
              hint="Off means no tax is charged on this item."
              checked={item.taxable}
              disabled={busy}
              onChange={toggleTaxable}
            />
          </div>

          {item.taxable && (
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] font-medium">Taxes</legend>
              {taxRates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Uses the business default rate. Add named rates in Settings to stack
                  taxes (GST + PST).
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Taxes stack. None ticked means the business default rate.
                  </p>
                  <div className="space-y-1 pt-1">
                    {taxRates.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.tax_rate_ids.includes(r.id)}
                          onChange={() => toggleTax(r.id)}
                          disabled={busy}
                          className="u-focus size-4 accent-[var(--primary)]"
                        />
                        {r.name + " (" + r.rate.toFixed(2) + "%)"}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          )}

          <section className="space-y-2 border-t border-line-soft pt-4">
            <h3 className="text-[13px] font-medium">Menu hours</h3>
            {itemWindows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No windows — available all day. Add one on the Availability tab.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {itemWindows.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm">{w.name}</span>
                    <Chip tone={w.scope === "item" ? "info" : "neutral"} dot={false}>
                      {summarizeWindow(w)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Only the batched Details fields have a Save. Every toggle on Visibility
          and everything on Modifiers has its own server action and has already
          saved by the time you read this, so a footer Save would be claiming
          credit for work that is done. */}
      <div className="flex items-center justify-between gap-2 border-t border-line-soft px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes to the details" : "All changes saved"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="lg" onClick={resetDraft} disabled={busy || !dirty}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={busy || !dirty || !name.trim()}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Save item
          </Button>
        </div>
      </div>
    </div>
  );
}
