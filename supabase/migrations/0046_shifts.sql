-- Phase 7: scheduling. Weekly shifts per staff member, publishable. Additive —
-- a brand-new feature that doesn't touch orders/money/approval.
create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id    uuid references public.staff_members(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  role_label  text,
  note        text,
  published   boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

alter table public.shifts enable row level security;

drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select
  using (exists (select 1 from public.business_members m
    where m.business_id = shifts.business_id and m.user_id = auth.uid()));

drop policy if exists shifts_write on public.shifts;
create policy shifts_write on public.shifts for all
  using (exists (select 1 from public.business_members m
    where m.business_id = shifts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m
    where m.business_id = shifts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

create index if not exists shifts_biz_start_idx on public.shifts (business_id, starts_at);
