-- P1.3 schedule depth: staff time-off / unavailability. Manager-entered dates a
-- staff member can't work; the scheduler warns when a shift overlaps. (Swap
-- requests reuse the existing approval_requests queue, kind 'shift_swap'.)
create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  date date not null,
  kind text not null default 'time_off',
  note text,
  created_at timestamptz not null default now(),
  unique (business_id, staff_id, date)
);
alter table public.staff_availability enable row level security;
drop policy if exists sa_select on public.staff_availability;
create policy sa_select on public.staff_availability for select
  using (exists (select 1 from public.business_members m
    where m.business_id = staff_availability.business_id and m.user_id = auth.uid()));
drop policy if exists sa_write on public.staff_availability;
create policy sa_write on public.staff_availability for all
  using (exists (select 1 from public.business_members m
    where m.business_id = staff_availability.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m
    where m.business_id = staff_availability.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
create index if not exists staff_availability_idx on public.staff_availability(business_id, date);
