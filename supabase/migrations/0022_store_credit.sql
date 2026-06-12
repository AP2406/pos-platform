-- P2-33 store credit (cross-vertical). Same ledger discipline as gift cards, but
-- keyed to a customer instead of a code. Real money in integer cents with an
-- append-only ledger; issued (manual grant or refund-to-credit) and redeemed as
-- a tender. One balance row per customer.
create table if not exists public.store_credit_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  balance_cents integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id)
);
create index if not exists store_credit_accounts_business_idx on public.store_credit_accounts(business_id);

create table if not exists public.store_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  delta_cents integer not null,     -- signed: +issue/refund, -redeem
  kind text not null,               -- 'issue' | 'refund' | 'redeem' | 'adjust'
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists store_credit_ledger_customer_idx on public.store_credit_ledger(customer_id);

alter table public.store_credit_accounts enable row level security;
alter table public.store_credit_ledger enable row level security;

drop policy if exists sca_select on public.store_credit_accounts;
create policy sca_select on public.store_credit_accounts for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists sca_insert on public.store_credit_accounts;
create policy sca_insert on public.store_credit_accounts for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists sca_update on public.store_credit_accounts;
create policy sca_update on public.store_credit_accounts for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

drop policy if exists scl_select on public.store_credit_ledger;
create policy scl_select on public.store_credit_ledger for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists scl_insert on public.store_credit_ledger;
create policy scl_insert on public.store_credit_ledger for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Atomic balance change keyed to a customer: create the account on first credit,
-- move the balance + append the ledger row in one statement, reject overdrafts.
create or replace function public.apply_store_credit_delta(
  p_business_id uuid,
  p_customer_id uuid,
  p_delta_cents integer,
  p_kind text,
  p_order_id uuid default null
) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_balance integer;
begin
  if not exists (
    select 1 from business_members
    where business_id = p_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  insert into store_credit_accounts (business_id, customer_id, balance_cents)
    values (p_business_id, p_customer_id, 0)
    on conflict (business_id, customer_id) do nothing;

  select balance_cents into v_balance
    from store_credit_accounts
    where business_id = p_business_id and customer_id = p_customer_id
    for update;

  if v_balance + p_delta_cents < 0 then
    raise exception 'insufficient_balance';
  end if;

  update store_credit_accounts
    set balance_cents = balance_cents + p_delta_cents, updated_at = now()
    where business_id = p_business_id and customer_id = p_customer_id;

  insert into store_credit_ledger (business_id, customer_id, delta_cents, kind, order_id)
    values (p_business_id, p_customer_id, p_delta_cents, p_kind, p_order_id);

  return v_balance + p_delta_cents;
end $$;
