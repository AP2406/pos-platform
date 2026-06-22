-- D2 + D9 manager narrative logs.
-- shift_logs: the manager "red book" — searchable shift-handoff notes / incidents,
-- distinct from the system audit_events log. customer_incidents: qualitative guest
-- complaint / allergy-incident records with resolution, distinct from the financial
-- exceptions report. Both membership-scoped, owner/manager write.

create table if not exists public.shift_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  shift_date date not null,
  category text not null default 'note',     -- note | incident | maintenance | cash | weather
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists shift_logs_business_date_idx on public.shift_logs(business_id, shift_date desc);

create table if not exists public.customer_incidents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  type text not null default 'complaint',    -- complaint | allergy | injury | service | other
  severity text not null default 'medium',   -- low | medium | high
  body text not null,
  resolution text,
  status text not null default 'open',        -- open | resolved
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_incidents_business_idx on public.customer_incidents(business_id, status, created_at desc);
create index if not exists customer_incidents_customer_idx on public.customer_incidents(customer_id);

alter table public.shift_logs enable row level security;
alter table public.customer_incidents enable row level security;

-- Members read; owner/manager write.
drop policy if exists shift_logs_select on public.shift_logs;
create policy shift_logs_select on public.shift_logs for select
  using (exists (select 1 from public.business_members m where m.business_id = shift_logs.business_id and m.user_id = auth.uid()));
drop policy if exists shift_logs_write on public.shift_logs;
create policy shift_logs_write on public.shift_logs for all
  using (exists (select 1 from public.business_members m where m.business_id = shift_logs.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = shift_logs.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

drop policy if exists customer_incidents_select on public.customer_incidents;
create policy customer_incidents_select on public.customer_incidents for select
  using (exists (select 1 from public.business_members m where m.business_id = customer_incidents.business_id and m.user_id = auth.uid()));
drop policy if exists customer_incidents_write on public.customer_incidents;
create policy customer_incidents_write on public.customer_incidents for all
  using (exists (select 1 from public.business_members m where m.business_id = customer_incidents.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = customer_incidents.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
