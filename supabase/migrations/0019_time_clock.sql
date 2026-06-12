-- P1-24 time clock. Staff clock in/out (identified by their PIN); shifts feed a
-- labor report. A partial unique index enforces at most one open shift per staff.
create table if not exists public.time_clock_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists time_clock_business_idx on public.time_clock_entries(business_id);
create unique index if not exists time_clock_one_open
  on public.time_clock_entries(business_id, staff_id) where clock_out is null;

alter table public.time_clock_entries enable row level security;
drop policy if exists tce_select on public.time_clock_entries;
create policy tce_select on public.time_clock_entries for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists tce_insert on public.time_clock_entries;
create policy tce_insert on public.time_clock_entries for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists tce_update on public.time_clock_entries;
create policy tce_update on public.time_clock_entries for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists tce_delete on public.time_clock_entries;
create policy tce_delete on public.time_clock_entries for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
