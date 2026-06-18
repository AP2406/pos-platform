-- Phase 6: fiscal-period lock. After an owner locks a period, sales dated
-- on/before the lock boundary can't be voided/reopened/adjusted. No lock = no
-- effect (additive).
create table if not exists public.period_locks (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  locked_through date not null,
  locked_by      uuid,
  created_at     timestamptz not null default now()
);

alter table public.period_locks enable row level security;

drop policy if exists period_locks_select on public.period_locks;
create policy period_locks_select on public.period_locks for select
  using (exists (select 1 from public.business_members m
    where m.business_id = period_locks.business_id and m.user_id = auth.uid()));

drop policy if exists period_locks_write on public.period_locks;
create policy period_locks_write on public.period_locks for all
  using (exists (select 1 from public.business_members m
    where m.business_id = period_locks.business_id and m.user_id = auth.uid() and m.role = 'owner'))
  with check (exists (select 1 from public.business_members m
    where m.business_id = period_locks.business_id and m.user_id = auth.uid() and m.role = 'owner'));

create index if not exists period_locks_biz_idx on public.period_locks (business_id, locked_through desc);
