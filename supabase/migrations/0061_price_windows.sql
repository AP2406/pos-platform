-- E1 time-based / happy-hour pricing. A price window overrides an item's (or a
-- whole category's) price during a recurring local-time window on chosen days.
-- mode 'price' = absolute happy-hour price; mode 'percent' = % off the regular
-- price. Highest priority wins; an item-scoped window beats a category one.
-- Resolved at ring-in so prices auto-switch during the window and revert after,
-- with no manual discounting. Money is numeric dollars.

create table if not exists public.price_windows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null default 'Happy hour',
  scope text not null default 'item',            -- item | category
  target_item_id uuid references public.catalog_items(id) on delete cascade,
  target_category text,
  days smallint[] not null default '{}',          -- 0=Sun..6=Sat; empty = every day
  start_min integer not null default 0,           -- minutes from local midnight
  end_min integer not null default 1440,
  mode text not null default 'percent',           -- price | percent
  value numeric not null default 0,               -- dollars (price) or percent off (percent)
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists price_windows_business_idx on public.price_windows(business_id, active);

alter table public.price_windows enable row level security;

-- Members read (the register needs them); owner/manager write.
drop policy if exists price_windows_select on public.price_windows;
create policy price_windows_select on public.price_windows for select
  using (exists (select 1 from public.business_members m where m.business_id = price_windows.business_id and m.user_id = auth.uid()));
drop policy if exists price_windows_write on public.price_windows;
create policy price_windows_write on public.price_windows for all
  using (exists (select 1 from public.business_members m where m.business_id = price_windows.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = price_windows.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
