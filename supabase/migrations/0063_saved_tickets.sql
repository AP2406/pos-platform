-- E4 + E7 saved tickets. A named, reusable set of cart lines: quick-tickets for
-- one-tap bar/counter ringing (scope 'quick') and saved favorite rounds for fast
-- re-ordering (scope 'favorite'). lines is a jsonb array of {catalog_item_id,
-- name, unit_price, quantity, note, allergy, course_id, variation_id, taxable}.

create table if not exists public.saved_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  scope text not null default 'quick',         -- quick | favorite
  lines jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists saved_tickets_business_idx on public.saved_tickets(business_id, scope, created_at desc);

alter table public.saved_tickets enable row level security;

-- Any member (a cashier on the till) can read, create and remove them.
drop policy if exists saved_tickets_all on public.saved_tickets;
create policy saved_tickets_all on public.saved_tickets for all
  using (exists (select 1 from public.business_members m where m.business_id = saved_tickets.business_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.business_members m where m.business_id = saved_tickets.business_id and m.user_id = auth.uid()));
