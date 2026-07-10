-- Per-item config parity with the TouchBistro item editor. All additive/nullable;
-- existing items behave identically until a value is set.
alter table public.catalog_items
  -- Reporting/tax grouping distinct from the DISPLAY category (food/alcohol/merch).
  add column if not exists sales_category text,
  -- Short name for kitchen tickets / KDS (falls back to name when null).
  add column if not exists short_name text,
  -- Open-price item: cashier is prompted for the amount at add time.
  add column if not exists open_price boolean not null default false,
  -- Requires a manager approval to add to an order.
  add column if not exists requires_manager_approval boolean not null default false,
  -- Allows negative price (returns/bottle deposits).
  add column if not exists allow_returns boolean not null default false,
  -- Print on its own separate order ticket (kitchen routing).
  add column if not exists print_separate_ticket boolean not null default false;

comment on column public.catalog_items.sales_category is
  'Reporting/tax sales category (e.g. Food/Alcohol/Merch), separate from the display category.';
