-- F14 deferred revenue. A deposit / catering / ticketed-event payment received in
-- advance sits as a liability until the event date, then releases to revenue. Each
-- record links to its journal entries (deferral on receipt, release on event).

create table if not exists public.deferred_revenue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  description text not null,
  customer_name text,
  amount numeric not null default 0,
  received_date date,
  event_date date,
  status text not null default 'deferred',         -- deferred | released | cancelled
  released_at timestamptz,
  journal_entry_id uuid,
  release_entry_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists deferred_revenue_business_idx on public.deferred_revenue(business_id, status, event_date);

alter table public.deferred_revenue enable row level security;
drop policy if exists deferred_revenue_all on public.deferred_revenue;
create policy deferred_revenue_all on public.deferred_revenue for all
  using (exists (select 1 from public.business_members m where m.business_id = deferred_revenue.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = deferred_revenue.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
