-- P0-13 86 hardening. (a) Realtime: publish catalog_items so a 86/un-86 on one
-- device reflects on every other POS within ~2s. (b) Auto-86: when a tracked
-- item's stock changes, flip out_of_stock at zero (and back on restock). The
-- trigger fires only when stock_qty actually changes, so a MANUAL 86 toggle
-- (out_of_stock change with no stock change) is preserved.

alter publication supabase_realtime add table public.catalog_items;
-- RLS-filtered realtime UPDATE events need the full old/new row.
alter table public.catalog_items replica identity full;

create or replace function public.auto_86_on_stock()
returns trigger language plpgsql as $$
begin
  if NEW.track_inventory and NEW.stock_qty is distinct from OLD.stock_qty then
    NEW.out_of_stock := (coalesce(NEW.stock_qty, 0) <= 0);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_auto_86 on public.catalog_items;
create trigger trg_auto_86 before update on public.catalog_items
  for each row execute function public.auto_86_on_stock();
