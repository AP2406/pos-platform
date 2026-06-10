-- Table Service v1 + visual floor plan. Additive + backwards-compatible.
--
-- Run once in the Supabase SQL editor (this repo has no migrations runner).
-- RLS mirrors the existing open_tickets policy exactly: membership via
-- business_members, role public, USING on select/update/delete and WITH CHECK
-- on insert/update. Existing held tickets (element_id = null) are unaffected.

-- 1) Floor elements — every object on the visual floor plan -------------------
-- kind: 'table' | 'seat' | 'counter' | 'station' | 'wall' | 'room' | 'label'.
-- Seats/counters/stations are ringable (each can hold its own order); tables
-- are containers; walls/rooms/labels are decoration. Geometry is integer pixels
-- on the design canvas.
create table if not exists public.floor_elements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null,
  label text,
  x int not null default 0,
  y int not null default 0,
  w int not null default 80,
  h int not null default 80,
  rotation int not null default 0,
  shape text not null default 'rect',
  parent_id uuid references public.floor_elements(id) on delete set null,
  seat_no int,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists floor_elements_business_idx on public.floor_elements(business_id);
-- No two active tables in a business may share a name (case-insensitive).
create unique index if not exists floor_elements_unique_table_label
  on public.floor_elements(business_id, lower(label))
  where kind = 'table' and is_active and label is not null;

-- 2) Bind an open ticket to a ringable element (persistent tab) ---------------
alter table public.open_tickets add column if not exists element_id uuid references public.floor_elements(id) on delete set null;
alter table public.open_tickets add column if not exists guest_count int;
alter table public.open_tickets add column if not exists opened_at timestamptz not null default now();

-- One OPEN ticket per element at a time (integrity).
create unique index if not exists open_tickets_one_per_element on public.open_tickets(element_id) where element_id is not null;

-- 3) Kitchen tickets (fired items the KDS reads, NOT paid orders) ------------
-- Kept separate from `orders` so fires never touch revenue/reporting.
create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  element_id uuid references public.floor_elements(id) on delete set null,
  label text,
  items jsonb not null,
  fired_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  created_by uuid
);
create index if not exists kitchen_tickets_business_idx on public.kitchen_tickets(business_id);
create index if not exists kitchen_tickets_open_idx on public.kitchen_tickets(business_id) where fulfilled_at is null;

-- 4) RLS — mirror open_tickets exactly ---------------------------------------
alter table public.floor_elements enable row level security;
alter table public.kitchen_tickets enable row level security;

-- floor_elements
drop policy if exists floor_elements_select on public.floor_elements;
create policy floor_elements_select on public.floor_elements for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_elements_insert on public.floor_elements;
create policy floor_elements_insert on public.floor_elements for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_elements_update on public.floor_elements;
create policy floor_elements_update on public.floor_elements for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_elements_delete on public.floor_elements;
create policy floor_elements_delete on public.floor_elements for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- kitchen_tickets
drop policy if exists kitchen_tickets_select on public.kitchen_tickets;
create policy kitchen_tickets_select on public.kitchen_tickets for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists kitchen_tickets_insert on public.kitchen_tickets;
create policy kitchen_tickets_insert on public.kitchen_tickets for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists kitchen_tickets_update on public.kitchen_tickets;
create policy kitchen_tickets_update on public.kitchen_tickets for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists kitchen_tickets_delete on public.kitchen_tickets;
create policy kitchen_tickets_delete on public.kitchen_tickets for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- 5) Realtime — so the KDS live subscription sees fires --------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kitchen_tickets'
  ) then
    alter publication supabase_realtime add table public.kitchen_tickets;
  end if;
end $$;
