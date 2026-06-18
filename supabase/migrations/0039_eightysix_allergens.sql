-- Phase 3: 86 (out-of-stock) metadata + structured allergens on menu items.
-- Per-line/per-seat allergy tags + notes ride in the existing cart/ticket jsonb
-- (no schema change).

alter table public.catalog_items
  add column if not exists out_of_stock_at timestamptz,   -- when it was 86'd
  add column if not exists out_of_stock_note text,         -- optional reason
  add column if not exists allergens jsonb not null default '[]'::jsonb;
