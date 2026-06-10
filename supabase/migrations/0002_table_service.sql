-- Table Service v1 schema. Additive + backwards-compatible.
--
-- Run once in the Supabase SQL editor (this repo has no migrations runner).
-- RLS mirrors the existing open_tickets policy exactly: membership via
-- business_members, role public, USING on select/update/delete and WITH CHECK
-- on insert/update. Existing held tickets (table_id = null) are unaffected.

-- 1) Floor areas (e.g. Patio, Main, Bar) -------------------------------------
create table if not exists public.floor_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists floor_areas_business_idx on public.floor_areas(business_id);

-- 2) Floor tables (the physical tables within an area) -----------------------
create table if not exists public.floor_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  area_id uuid references public.floor_areas(id) on delete set null,
  label text not null,
  seats int not null default 2,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists floor_tables_business_idx on public.floor_tables(business_id);

-- 3) Bind an open ticket to a table (persistent table tab) -------------------
alter table public.open_tickets add column if not exists table_id uuid references public.floor_tables(id) on delete set null;
alter table public.open_tickets add column if not exists guest_count int;
alter table public.open_tickets add column if not exists opened_at timestamptz not null default now();

-- One OPEN ticket per table at a time (integrity).
create unique index if not exists open_tickets_one_per_table on public.open_tickets(table_id) where table_id is not null;

-- 4) Kitchen tickets (fired items the KDS reads, NOT paid orders) ------------
-- Kept separate from `orders` so fires never touch revenue/reporting.
create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  table_id uuid references public.floor_tables(id) on delete set null,
  label text,
  items jsonb not null,
  fired_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  created_by uuid
);
create index if not exists kitchen_tickets_business_idx on public.kitchen_tickets(business_id);
create index if not exists kitchen_tickets_open_idx on public.kitchen_tickets(business_id) where fulfilled_at is null;

-- 5) RLS — mirror open_tickets exactly ---------------------------------------
alter table public.floor_areas enable row level security;
alter table public.floor_tables enable row level security;
alter table public.kitchen_tickets enable row level security;

-- floor_areas
drop policy if exists floor_areas_select on public.floor_areas;
create policy floor_areas_select on public.floor_areas for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_areas_insert on public.floor_areas;
create policy floor_areas_insert on public.floor_areas for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_areas_update on public.floor_areas;
create policy floor_areas_update on public.floor_areas for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_areas_delete on public.floor_areas;
create policy floor_areas_delete on public.floor_areas for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- floor_tables
drop policy if exists floor_tables_select on public.floor_tables;
create policy floor_tables_select on public.floor_tables for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_tables_insert on public.floor_tables;
create policy floor_tables_insert on public.floor_tables for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_tables_update on public.floor_tables;
create policy floor_tables_update on public.floor_tables for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_tables_delete on public.floor_tables;
create policy floor_tables_delete on public.floor_tables for delete
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

-- 6) Realtime — so the KDS live subscription sees fires --------------------
-- Idempotent: only add the table to the publication if it isn't already in it.
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
