-- Phase 4: per-item prep target (minutes) so KDS aging colours compute against
-- cook time instead of a fixed clock. Null = use the default 10m/18m thresholds.
alter table public.catalog_items
  add column if not exists prep_minutes integer;
