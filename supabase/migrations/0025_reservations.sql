-- P2-30 reservations + waitlist (full-service). One table holds both future
-- bookings (scheduled_at set) and walk-in waitlist entries (scheduled_at null,
-- a quoted wait). Seating links the entry to a floor table. SMS notifications
-- are deferred (need a provider); this is the data + floor model.
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  guest_name text not null,
  party_size integer not null default 2,
  phone text,
  scheduled_at timestamptz,                 -- null = walk-in waitlist (seated now-ish)
  quoted_wait_min integer,                  -- estimate shown to a waitlisted guest
  element_id uuid references public.floor_elements(id) on delete set null,
  status text not null default 'booked',    -- booked | waitlisted | seated | cancelled | no_show | done
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists reservations_business_idx on public.reservations(business_id);
create index if not exists reservations_status_idx on public.reservations(business_id, status);

alter table public.reservations enable row level security;
drop policy if exists res_select on public.reservations;
create policy res_select on public.reservations for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists res_insert on public.reservations;
create policy res_insert on public.reservations for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists res_update on public.reservations;
create policy res_update on public.reservations for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists res_delete on public.reservations;
create policy res_delete on public.reservations for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
