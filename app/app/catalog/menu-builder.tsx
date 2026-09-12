"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORY_PALETTE, tileClassesFor } from "../pos/category-colors";
import {
  saveCategoryColors,
  setCatalogItemActive,
  setCatalogItemOutOfStock,
  setCatalogItemTaxable,
} from "./actions";
import { ItemEditor } from "./item-editor";
import { ImportMenu } from "./import-menu";
import { MenuBoardLink } from "./menu-board-link";
import { CoursesCard } from "./courses-card";
import { AvailabilityCard } from "../settings/availability-card";
import type { AvailabilityWindow } from "../settings/availability-actions";
import type { Course } from "../pos/courses-actions";
import {
  NO_CATEGORY,
  STATUS_LABEL,
  categoriesOf,
  itemsInCategory,
  money,
  statusOf,
  type CourseOption,
  type Item,
  type StationOption,
  type TaxRate,
} from "./item-model";

const STATUS_TONE = {
  available: "success",
  sold_out: "danger",
  hidden: "neutral",
} as const;

/* ------------------------------------------------------------------ rail -- */

function CategoryRail({
  items,
  selected,
  onSelect,
  colors,
  onSetColor,
  pending,
  canManage,
}: {
  items: Item[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  colors: Record<string, string>;
  onSetColor: (category: string, key: string) => void;
  pending: boolean;
  canManage: boolean;
}) {
  const categories = useMemo(() => categoriesOf(items), [items]);
  const uncategorised = items.filter((i) => !(i.category || "").trim()).length;

  const entries: { key: string | null; label: string; count: number }[] = [
    { key: null, label: "All items", count: items.length },
    ...categories.map((c) => ({
      key: c,
      label: c,
      count: items.filter((i) => (i.category || "").trim() === c).length,
    })),
  ];
  if (uncategorised > 0) {
    entries.push({ key: NO_CATEGORY, label: "Uncategorised", count: uncategorised });
  }

  // Only a real, named category has a colour to set — "All items" spans every
  // colour and the uncategorised bucket is the neutral tile by definition.
  const colourTarget =
    selected !== null && selected !== NO_CATEGORY ? selected : null;
  const previewItems = itemsInCategory(items, selected).slice(0, 4);

  return (
    // No longer sticky: the pane is a full-height column inside a full-height
    // page, so it has nowhere to scroll away TO. What it needs instead is a
    // bounded body that scrolls on its own when a merchant has forty categories.
    <Panel className="lg:min-h-0">
      <div className="shrink-0 border-b border-line-soft px-4 py-3">
        <h2 className="text-[13px] font-medium tracking-tight">Categories</h2>
      </div>

      {/* One markup, two shapes: a scrolling chip strip on a phone, a vertical
          rail from lg up. A second copy of the list behind a media query is a
          second copy to keep in sync. */}
      <div
        role="group"
        aria-label="Filter by category"
        className="flex gap-1.5 overflow-x-auto p-2 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
      >
        {entries.map((e) => {
          const active = selected === e.key;
          return (
            <button
              key={e.key ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(e.key)}
              className={
                "u-tx u-focus flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm lg:w-full " +
                (active
                  ? "bg-primary/10 font-medium text-primary ring-1 ring-inset ring-primary/30"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              {e.key !== null && e.key !== NO_CATEGORY && (
                <span
                  aria-hidden
                  className={
                    "size-2.5 shrink-0 rounded-full border " +
                    tileClassesFor(e.key, colors)
                  }
                />
              )}
              <span className="min-w-0 flex-1 truncate">{e.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {e.count}
              </span>
            </button>
          );
        })}
      </div>

      {colourTarget && canManage && (
        <div className="shrink-0 border-t border-line-soft px-4 py-3">
          <p id="cat-colour-label" className="text-xs font-medium">
            Register colour
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Colour is per category, not per item.
          </p>
          <div
            role="group"
            aria-labelledby="cat-colour-label"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {CATEGORY_PALETTE.map((p) => {
              const chosen = colors[colourTarget] === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={colourTarget + " " + p.label}
                  title={p.label}
                  disabled={pending}
                  onClick={() => onSetColor(colourTarget, p.key)}
                  className={
                    "u-focus size-5 rounded-full " +
                    p.swatch +
                    (chosen ? " ring-2 ring-foreground ring-offset-2 ring-offset-card" : "")
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {previewItems.length > 0 && (
        <div className="hidden shrink-0 border-t border-line-soft px-4 py-3 lg:block">
          <p className="text-xs font-medium">On the register</p>
          {/* Two columns, not three. At three the tile was ~48px wide inside a
              176px rail and every name over one short word clipped —
              "Mushr… risotto" is not a preview of anything. Two tiles of ~85px
              hold two lines of a real dish name, and the fourth item makes the
              block square instead of a stripe. */}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {previewItems.map((i) => (
              <div
                key={i.id}
                aria-hidden
                className={
                  "flex min-h-16 flex-col justify-between gap-1 rounded-lg border p-1.5 text-[10px] leading-tight " +
                  tileClassesFor(i.category, colors) +
                  (i.out_of_stock ? " opacity-50" : "")
                }
              >
                <span className="line-clamp-3 font-semibold hyphens-auto">
                  {i.name}
                </span>
                <span className="tabular-nums opacity-80">
                  {i.out_of_stock ? "86'd" : money(i.price)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A real preview — same colour resolver the register uses.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- row -- */

function ItemRow({
  item,
  colors,
  selected,
  onSelect,
  onPatch,
}: {
  item: Item;
  colors: Record<string, string>;
  selected: boolean;
  onSelect: () => void;
  onPatch: (id: string, patch: Partial<Item>) => void;
}) {
  const [pending, startTransition] = useTransition();
  // An image_url that 404s (storage object deleted, bucket renamed, a row
  // carried over from an import) used to render the browser's broken-image
  // glyph, which reads as "this product is broken" rather than "this item has
  // no photo". One failed load and the row falls back to the same category
  // swatch an item with no photo at all gets.
  const [photoFailed, setPhotoFailed] = useState(false);
  const status = statusOf(item);

  const meta: string[] = [];
  if (item.category) meta.push(item.category);
  if (item.variations.length > 0) {
    meta.push(
      item.variations.length +
        (item.variations.length === 1 ? " variation" : " variations")
    );
  }
  if (item.modifiers.length > 0) {
    meta.push(
      item.modifiers.length + (item.modifiers.length === 1 ? " add-on" : " add-ons")
    );
  }
  if (!item.taxable) meta.push("Tax-free");
  if (item.barcode) meta.push("Code " + item.barcode);

  function toggleStock() {
    startTransition(async () => {
      const next = !item.out_of_stock;
      const res = await setCatalogItemOutOfStock(item.id, next);
      if (!("error" in res)) {
        onPatch(item.id, { out_of_stock: next, out_of_stock_at: next ? res.at : null });
      }
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const res = await setCatalogItemActive(item.id, !item.is_active);
      if (!("error" in res)) onPatch(item.id, { is_active: !item.is_active });
    });
  }

  function toggleTaxable() {
    startTransition(async () => {
      const res = await setCatalogItemTaxable(item.id, !item.taxable);
      if (!("error" in res)) onPatch(item.id, { taxable: !item.taxable });
    });
  }

  return (
    <li
      className={
        "u-tx flex items-center gap-3 pr-2 " +
        (selected ? "bg-primary/8 ring-1 ring-inset ring-primary/25" : "hover:bg-accent/50")
      }
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className="u-focus-inset flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left"
      >
        {item.image_url && !photoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            onError={() => setPhotoFailed(true)}
            className="size-9 shrink-0 rounded-md object-cover ring-1 ring-line-soft"
          />
        ) : (
          // Not a "missing photo" slot: it is the item's real register tile
          // colour, which is information the merchant actually has.
          <span
            aria-hidden
            className={
              "size-9 shrink-0 rounded-md border " + tileClassesFor(item.category, colors)
            }
          />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={
              "block truncate text-sm font-medium " +
              (item.is_active ? "" : "text-muted-foreground")
            }
          >
            {item.name}
          </span>
          {meta.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {meta.join(" · ")}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm tabular-nums">{money(item.price)}</span>
      </button>

      {/* "Available" is the expected state, so on a narrow row it is the one
          that can be dropped for space — the two that carry news never are. */}
      <Chip
        tone={STATUS_TONE[status]}
        className={
          status === "available" ? "hidden shrink-0 sm:inline-flex" : "shrink-0"
        }
      >
        {STATUS_LABEL[status]}
      </Chip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={"Actions for " + item.name}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onSelect}>Edit item</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={toggleStock}>
            {item.out_of_stock ? "Back in stock" : "Mark sold out (86)"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleActive}>
            {item.is_active ? "Hide from register" : "Show on register"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleTaxable}>
            {item.taxable ? "Make tax-free" : "Make taxable"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* --------------------------------------------------------------- builder -- */

export function MenuBuilder({
  businessId,
  moduleLabel,
  currency,
  initialItems,
  taxRates,
  initialCategoryColors,
  courses,
  stations,
  availabilityWindows,
  courseRows,
  hasFloorService,
  canManage,
  hasOtherLocations,
}: {
  businessId: string;
  /** "Menu" / "Products" / "Services" — the vertical's own word, from presets.ts. */
  moduleLabel: string;
  currency: string;
  initialItems: Item[];
  taxRates: TaxRate[];
  initialCategoryColors: Record<string, string>;
  courses: CourseOption[];
  stations: StationOption[];
  availabilityWindows: AvailabilityWindow[];
  courseRows: Course[];
  hasFloorService: boolean;
  canManage: boolean;
  hasOtherLocations: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [colors, setColors] = useState(initialCategoryColors);
  const [colourError, setColourError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const categoryOptions = useMemo(() => categoriesOf(items), [items]);

  const visible = useMemo(() => {
    const scoped = itemsInCategory(items, category);
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.short_name || "").toLowerCase().includes(q) ||
        (i.barcode || "").toLowerCase().includes(q)
    );
  }, [items, category, query]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const editorOpen = creating || selected !== null;

  function patchItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function handleCreated(item: Item) {
    setItems((prev) => [...prev, item]);
    setCreating(false);
    setSelectedId(item.id);
  }

  function handleSetColor(cat: string, key: string) {
    setColourError(null);
    const before = colors;
    const next = { ...colors };
    if (next[cat] === key) delete next[cat];
    else next[cat] = key;
    setColors(next);
    startTransition(async () => {
      // saveCategoryColors → authorizeAction("edit_menu", { configWrite: true })
      // plus its own owner/manager check.
      const res = await saveCategoryColors(next);
      if ("error" in res) {
        setColourError(res.error);
        setColors(before);
      }
    });
  }

  function selectItem(id: string) {
    setCreating(false);
    setSelectedId(id);
  }

  function closeEditor() {
    setCreating(false);
    setSelectedId(null);
  }

  const hasLinkOuts = canManage;

  return (
    // A working surface, not a document. The shell now hands a page the whole
    // viewport (see app-shell.tsx), and this screen takes it: the header and
    // the tab strip are fixed furniture, the three panes below split what's
    // left, and each scrolls inside itself. Before, the panes stopped wherever
    // the item list happened to end and the list scrolled in a 640px box with
    // half a screen of empty canvas underneath it.
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{moduleLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What you sell, how it is priced, and how it looks on the register. Every
            change here is live the moment it saves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The mockup's "Preview menu". It previews the LIVE menu board, because
              there is no draft to preview — see docs/menu-builder-audit.md. */}
          <Button variant="subtle" size="lg" asChild>
            <a
              href={"/menu/" + businessId}
              target="_blank"
              rel="noreferrer"
              data-icon="inline-end"
            >
              Preview menu
              <ExternalLinkIcon />
            </a>
          </Button>
          <MenuBoardLink businessId={businessId} />
          <ImportMenu />

          {hasLinkOuts && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="subtle" size="lg" aria-label="More menu tools">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Menu tools</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/app/recipes">Recipes &amp; costing</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/purchasing">Purchasing</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/waste">Waste</Link>
                </DropdownMenuItem>
                {hasOtherLocations && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/app/catalog/push">Push to locations</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
            data-icon="inline-start"
          >
            <PlusIcon />
            Add item
          </Button>
        </div>
      </header>

      <Tabs defaultValue="items" className="min-h-0 flex-1">
        <TabsList className="mb-4 shrink-0">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          {hasFloorService && <TabsTrigger value="courses">Courses</TabsTrigger>}
        </TabsList>

        <TabsContent
          value="items"
          className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
        >
          {/* Three panes at xl, where 960px of content actually fits three. Below
              that the editor takes the list's grid cell and the list steps aside
              — a master/detail swap, not a modal, and nothing is hidden behind a
              scrim.
              The rail is 13rem rather than 11: at 11 the register preview's
              tiles were too narrow to hold a dish name, and a category list
              pressed against its own counters reads as cramped.
              items-stretch + lg:flex-1 is what makes the three panes equal-height
              columns of the screen instead of three cards of three heights. */}
          <div className="grid items-stretch gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
            <CategoryRail
              items={items}
              selected={category}
              onSelect={setCategory}
              colors={colors}
              onSetColor={handleSetColor}
              pending={pending}
              canManage={canManage}
            />

            <Panel
              className={
                "lg:min-h-0 " + (editorOpen ? "hidden xl:flex" : "flex")
              }
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-line-soft px-4 py-3">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Label htmlFor="menu-search" className="sr-only">
                    Search items
                  </Label>
                  <Input
                    id="menu-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search items"
                    className="h-9 pl-8"
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {visible.length + (visible.length === 1 ? " item" : " items")}
                </span>
              </div>

              {/* The list owns the leftover height and scrolls in it, so a
                  menu of ten fills the pane and a menu of four hundred is the
                  only thing that moves when you flick it. */}
              <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {visible.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title={items.length === 0 ? "Nothing on the menu yet" : "No matches"}
                      description={
                        items.length === 0
                          ? "Add your first item, or import an existing menu from a PDF, photo or spreadsheet."
                          : "Try a different search, or pick another category."
                      }
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {visible.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        colors={colors}
                        selected={item.id === selectedId}
                        onSelect={() => selectItem(item.id)}
                        onPatch={patchItem}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            {editorOpen && (
              // Was `xl:sticky xl:max-h-[calc(100dvh-3rem)]` — a card pinned to
              // the viewport inside a document that scrolled past it. Now it is
              // simply the third column of a full-height row, and ItemEditor's
              // own `min-h-0 flex-1` body does the scrolling it was already
              // written to do.
              <Panel className="lg:min-h-0">
                {/* Below xl the list is not on screen, so the panel needs its own
                    way back. */}
                <div className="shrink-0 border-b border-line-soft px-3 py-2 xl:hidden">
                  <Button variant="ghost" size="sm" onClick={closeEditor}>
                    &larr; Back to items
                  </Button>
                </div>
                <ItemEditor
                  // Remount on selection change: the draft fields are seeded from
                  // props in useState, and a key is how that stays honest.
                  key={creating ? "new" : selected?.id}
                  mode={creating ? "new" : "edit"}
                  item={creating ? null : selected}
                  allItems={items}
                  categoryOptions={categoryOptions}
                  taxRates={taxRates}
                  courses={courses}
                  stations={stations}
                  currency={currency}
                  windows={availabilityWindows}
                  onPatch={patchItem}
                  onCreated={handleCreated}
                  onClose={closeEditor}
                />
              </Panel>
            )}
          </div>

          {colourError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {colourError}
            </p>
          )}
        </TabsContent>

        {/* These two are documents, not working surfaces — they scroll inside
            the pane rather than driving the page's height. */}
        <TabsContent value="availability" className="min-h-0 flex-1 overflow-y-auto">
          <Panel className="max-w-3xl">
            <div className="border-b border-line-soft px-5 py-4">
              <h2 className="text-[15px] font-semibold tracking-tight">Menu hours</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dayparting. Also editable under Settings — same windows, same actions.
              </p>
            </div>
            <div className="px-5 py-4">
              <AvailabilityCard
                initialWindows={availabilityWindows}
                items={items.map((i) => ({ id: i.id, name: i.name }))}
                categories={categoryOptions}
                canManage={canManage}
              />
            </div>
          </Panel>
        </TabsContent>

        {hasFloorService && (
          <TabsContent value="courses" className="min-h-0 flex-1 overflow-y-auto">
            <Panel className="max-w-3xl">
              <div className="border-b border-line-soft px-5 py-4">
                <h2 className="text-[15px] font-semibold tracking-tight">Courses</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The firing order a table&rsquo;s items are grouped into.
                </p>
              </div>
              <div className="px-5 py-4">
                <CoursesCard initial={courseRows} />
              </div>
            </Panel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
