# Menu builder — mockup vs. product

Audit taken before the `admin-redesign` rebuild of `/app/catalog`. The mockup is a
picture of a product; this is what the picture is actually standing on.

Short version: **the mockup is roughly 60% design and 40% roadmap.** The item
model is richer than the mockup shows (taxes, allergens, courses, stations,
variations, nested modifiers, 86ing, barcodes). The *organising* model is much
thinner: there is no draft state, no menus table, no reusable modifier-group
library, and no ordering column anywhere in the catalog. Three of the mockup's
four tabs and its entire publish bar describe features that do not exist.

## Inventory

| Mockup feature | Exists today? | Where (file:line / table.column) | Gap |
| --- | --- | --- | --- |
| **Publish bar** | | | |
| Amber `Unpublished changes` indicator | **No** | No draft/version column on `catalog_items`; `grep -niE 'draft\|publish' supabase/migrations/` finds only `purchase_orders.status` (0030) and `shifts.published` (0046) | **Large — feature, not styling.** Every catalog write is live the instant it saves: each action calls `revalidatePath("/app/catalog")` and the stock/86/tax/image ones also `revalidatePath("/app/pos")` (`app/app/catalog/actions.ts:181-182, 243-244, 352-353, 385-386, 787-788`). There is nothing to publish. |
| `Publish changes` button | **No** | — | **Large.** Same. A button here would be a lie with a spinner on it. |
| `Preview menu` button | **Yes, differently** | `app/menu/[businessId]/page.tsx`; public RPC `get_public_menu` (`supabase/migrations/0075_menu_dayparting.sql`); link copier at `app/app/catalog/menu-board-link.tsx:1-23` | **None.** The public menu board is real and already honours availability windows. It previews *live* data, not a draft. |
| **Tabs** | | | |
| `Items` | **Yes** | `catalog_items` | None. |
| `Modifier groups` (as a top-level library) | **Partly — and not as a library** | `catalog_modifier_groups.catalog_item_id uuid **not null**` (`supabase/migrations/0010_modifier_groups.sql:9`) | **Medium.** Groups are real, rich (required / min / max / `allow_split` / nested `child_group_id`) — but **per item**. There is no shared group reused across items. A top-level tab would imply a library that cannot exist without a schema change. |
| `Menus` (several named menus) | **No** | No `menus` table. The nearest things are the free-text `catalog_items.category` and `catalog_items.sales_category` (0088) | **Large.** Omitted. |
| `Availability` | **Yes** | `availability_windows` (`supabase/migrations/0075_menu_dayparting.sql:12-26`); actions `app/app/settings/availability-actions.ts`; UI `app/app/settings/availability-card.tsx` | **None — it just lives in the wrong place.** Full dayparting (item- or category-scoped, day mask, local-time window) enforced server-side by `catalog_available_now()`. Relocated onto this screen. |
| **Categories rail** | | | |
| Category list | **Yes, derived** | `catalog_items.category text` — free text, no `categories` table | Small. Categories are the distinct non-empty values across items. |
| Per-category item counts | **Yes, derived** | same | None. |
| Drag-reorder handles | **No** | No `sort_order` / `position` on `catalog_items` **or** on any category concept. Items are ordered by `created_at` (`app/app/catalog/page.tsx:26`); category order is alphabetical | **Medium.** Not built. A handle that reorders nothing is worse than no handle. (`sort_order` exists on `catalog_modifier_groups`, `courses`, `kitchen_stations`, `floor_plans` — just never on items or categories.) |
| Per-category colour | **Yes — better than the mockup** | `businesses.category_colors jsonb` (`supabase/migrations/0001_register_photos_categories.sql:24-25`); palette `app/app/pos/category-colors.ts:19-30`; save `saveCategoryColors` (`actions.ts:357`) | None. Kept, and moved next to the category it colours. |
| **Item rows** | | | |
| Thumbnail photo | **Yes** | `catalog_items.image_url`; real upload path to the public `item-images` storage bucket (`catalog-client.tsx:65-82`, policies in `0001_register_photos_categories.sql:31-45`) | None. |
| Name, price | **Yes** | `catalog_items.name`, `.price` | None. |
| `Available` / `Sold out` pill | **Yes — two flags, not one** | `catalog_items.is_active` and `catalog_items.out_of_stock` + `.out_of_stock_at` (`0003_v11.sql:5`, `0039_eightysix_allergens.sql`) | Small. The mockup's single pill collapses two independent states (hidden from the register vs. 86'd today). Shown as three distinct states instead. |
| `•••` overflow | **No UI, but every action behind it exists** | `setCatalogItemOutOfStock`, `setCatalogItemActive`, `setCatalogItemTaxable` (`actions.ts:159, 248, 268`) | Small. Built; wired to those three. **No delete** — `deleteCatalogItem` does not exist anywhere in the codebase and was not invented. |
| **POS tile preview** | | | |
| Three coloured tiles | **Yes, as a preview** | `tileClassesFor()` (`app/app/pos/category-colors.ts:50-60`), the same function the register uses | None — it is a true preview, driven by the register's own resolver. |
| Per-**item** tile colour | **No** | Colour is keyed by **category** name, with a deterministic hash fallback so every category is accented (`category-colors.ts:43-48, 58-59`) | Small. Labelled as category colour. Three tiles of three different colours in one category, as the mockup shows, cannot happen. |
| **Edit panel** | | | |
| Right-hand panel (not a modal) | Was neither | Today it is an inline accordion under the row (`catalog-client.tsx:736`) | Rebuilt as a right-hand panel. |
| `Details` / `Modifiers` / `Visibility` tabs | Fields exist, tabs did not | — | Built. |
| Photo + `Change photo` | **Yes** | `setCatalogItemImage` (`actions.ts:327`) | None. |
| Name | **Yes** | `updateCatalogItem` (`actions.ts:117`) | None. |
| **Description** | **No** | **There is no `description` column on `catalog_items`.** `grep -n description supabase/migrations/*.sql` returns nothing catalog-related | **Medium.** Omitted. Nothing would store it, and the four customer-facing menu RPCs (`get_public_menu`, `get_online_menu`, `get_kiosk_menu`, `get_guest_menu`) select only `name, price, category`. |
| `Price (CAD)` | **Yes, and the currency is real** | `businesses.currency` (`lib/services/tenancy.ts:34`) | None — rendered from the business's own currency rather than hardcoded CAD. |
| `Category` | **Yes** | `catalog_items.category` | None. |
| `Modifier groups` w/ `Required · Select 1`, `Optional · Up to 4` | **Yes, exactly** | `required`, `min_select`, `max_select` (`0010_modifier_groups.sql:11-13`); editor `app/app/catalog/modifier-groups-editor.tsx` | None. The mockup's summary line is generated from the real columns. |
| `Available for sale` toggle | **Yes** | `setCatalogItemActive` → `is_active` | None. |
| `Cancel` / `Save item` | Partly | `updateCatalogItem` batches name/price/category/sales_category/short_name/flags; the rest are per-field actions with their own validation | Small. Batched save for the text fields; toggles stay immediate (that is what their actions are). |
| **Top bar** | | | |
| Location switcher (business + sub-label) | **Yes, in the sidebar** | `WorkspaceSwitcher` (`app/app/_components/app-shell.tsx:22-143`) — name + mode + role, plus roll-up links | None. **Not duplicated into a page top bar**; two switchers on one screen is a bug, not a feature. |
| User chip (name + role) | **Partly** | Role is on the workspace switcher (`app-shell.tsx:69-71`); sign-out is at the sidebar foot | Small, and out of scope for this screen — it is shell furniture. |
| **Sidebar** | | | |
| `Overview, Orders, Floor plan, Menu builder, Inventory, Team, Reports, Settings, Help & support` | **Structurally different on purpose** | `lib/modules/nav.ts:123-208` — grouped, mode-filtered (`enabledModules`) and permission-filtered (`canOpenRoute`) | **Not touched.** Hardcoding the mockup's nine labels would break the permission model and every non-restaurant vertical. Note the mockup's own label is already half-right: `presets.ts:47` labels this module **"Menu"** for restaurants, "Products" for retail, "Services" for service, "Items" for mobile sellers. The page title now follows that same vocab instead of saying "Catalog" to a barber. |

## What the current page can do that the mockup does not show

All of this is real, shipped, and had to survive the redesign:

- **Variations** (sizes) — `catalog_item_variations`, `createVariation` / `deleteVariation`.
- **Nested modifiers** — an option can trigger a follow-up group (`child_group_id`, 0011).
- **Half / left-right modifiers** — `allow_split` (0087), pizza-style.
- **Multi-tax per item** — `catalog_item_taxes` junction (0092), taxes stack.
- **Allergens** — `catalog_items.allergens[]` (0039); bold red on the KDS and the chit.
- **Prep minutes** — `catalog_items.prep_minutes` (0040); drives KDS aging colour.
- **Default course** — `catalog_items.default_course_id` (0009), full-service only.
- **Prep station** — `catalog_items.station_id` (0017), full-service only.
- **Courses management** — create/rename/reorder/delete (`app/app/pos/courses-actions.ts`).
- **86 / restock**, including a mirror out to connected delivery platforms (`notifyPlatforms86`).
- **Barcode / SKU** with a cross-item duplicate check (`setCatalogItemBarcode`).
- **Register flags** — open price, requires manager approval, allows returns, print separate ticket (0088).
- **AI menu import** from PDF / photo / docx / xlsx / csv / URL (`import-menu.tsx`, `import-actions.ts`).
- **Push menu to other locations** (`/app/catalog/push`).
- **Public menu board link** (`/menu/{businessId}`).
- Link-outs to Recipes & costing, Purchasing, Waste.

## Authorization, as found

Every catalog mutation in `app/app/catalog/actions.ts` opens with
`authorizeAction("edit_menu", { configWrite: true })` — 20 of 20. That is the fix
from `56c75df`, and nothing here weakens it.

Two neighbouring action files this screen consumes are guarded differently, and
that predates this work:

- `app/app/pos/courses-actions.ts` and `app/app/kitchen/stations-actions.ts` use a
  local `requireManager()` (owner/manager only) rather than `authorizeAction`.
- `app/app/settings/availability-actions.ts` uses `requireBusiness()` plus an
  inline owner/manager check, and no `assertConfigEditable` — so a demo business
  can currently edit menu hours where it cannot edit anything else on the menu.
- `app/app/catalog/import-actions.ts` uses `requireBusiness()` + a role check.

All three are backed by RLS policies restricted to `owner`/`manager`. They were
left exactly as they are: changing permissions was explicitly out of scope, and
a redesign is the wrong commit to move a security boundary in. **Flagged as a
follow-up**, not as this branch's problem.

## Follow-ups this audit generates

1. **Draft / publish for the menu.** The big one. Needs a versioned or shadow
   representation of `catalog_items` + a publish action + a diff surface. Sizeable;
   deliberately not attempted here.
2. **Item and category ordering.** A `sort_order` column on `catalog_items` and a
   real `categories` table (name, colour, position) would make both the drag
   handles and the category colour map non-derived. Today `category_colors` is
   keyed by the category *string*, so renaming a category silently drops its colour.
3. **Reusable modifier groups.** Drop the `not null` on
   `catalog_modifier_groups.catalog_item_id` and add a join table, and the
   mockup's `Modifier groups` tab becomes buildable.
4. **Item description.** One column, and the four menu RPCs widened to select it.
5. **Normalise the guards** on courses / stations / availability / import onto
   `authorizeAction`, and give availability windows the `configWrite` demo lock.
