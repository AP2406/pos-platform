-- P1-14 KDS prep-station routing. Additive. Map menu items to stations (Grill,
-- Fryer, Bar…); when a course/ticket is fired, the items split into one kitchen
-- ticket per station so each KDS screen sees only its own work. With no stations
-- defined, firing behaves exactly as today (one ticket, station_id null).

create table if not exists public.kitchen_stations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists kitchen_stations_business_idx on public.kitchen_stations(business_id);

alter table public.catalog_items
  add column if not exists station_id uuid references public.kitchen_stations(id) on delete set null;
alter table public.kitchen_tickets
  add column if not exists station_id uuid references public.kitchen_stations(id) on delete set null;

alter table public.kitchen_stations enable row level security;
drop policy if exists ks_select on public.kitchen_stations;
create policy ks_select on public.kitchen_stations for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ks_insert on public.kitchen_stations;
create policy ks_insert on public.kitchen_stations for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ks_update on public.kitchen_stations;
create policy ks_update on public.kitchen_stations for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ks_delete on public.kitchen_stations;
create policy ks_delete on public.kitchen_stations for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
