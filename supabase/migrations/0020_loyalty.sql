-- P2-31 loyalty (cross-vertical). A points balance per customer + an append-only
-- transaction ledger (earn on paid orders, redeem as a reason-coded discount).
-- Points are integers; redemption value is computed at checkout. Config lives in
-- businesses.loyalty_settings.
create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id)
);
create index if not exists loyalty_accounts_business_idx on public.loyalty_accounts(business_id);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  points integer not null,          -- signed: +earn, -redeem
  kind text not null,               -- 'earn' | 'redeem' | 'adjust'
  created_at timestamptz not null default now()
);
create index if not exists loyalty_tx_business_idx on public.loyalty_transactions(business_id);
create index if not exists loyalty_tx_customer_idx on public.loyalty_transactions(customer_id);

alter table public.businesses add column if not exists loyalty_settings jsonb;

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;

drop policy if exists la_select on public.loyalty_accounts;
create policy la_select on public.loyalty_accounts for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists la_insert on public.loyalty_accounts;
create policy la_insert on public.loyalty_accounts for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists la_update on public.loyalty_accounts;
create policy la_update on public.loyalty_accounts for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

drop policy if exists lt_select on public.loyalty_transactions;
create policy lt_select on public.loyalty_transactions for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists lt_insert on public.loyalty_transactions;
create policy lt_insert on public.loyalty_transactions for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
