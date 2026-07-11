-- House accounts (accounts receivable): a customer runs a tab that is billed as
-- revenue at the point of sale and settled (paid down) later. balance_cents is the
-- amount the customer OWES the business (>= 0). Mirrors store credit but with the
-- opposite sign (an asset, not a liability).
create table if not exists public.house_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  enabled boolean not null default true,
  limit_cents bigint,                          -- null = no credit limit
  balance_cents bigint not null default 0,     -- amount currently owed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id)
);
alter table public.house_accounts enable row level security;
create policy house_accounts_rw on public.house_accounts for all
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

create table if not exists public.house_account_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  delta_cents bigint not null,                 -- +charge (increases owed), -payment (reduces owed)
  kind text not null,                          -- 'charge' | 'payment' | 'adjust'
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.house_account_ledger enable row level security;
create policy house_account_ledger_rw on public.house_account_ledger for all
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
create index if not exists house_account_ledger_cust
  on public.house_account_ledger(business_id, customer_id, created_at desc);

-- Atomic apply: locks the account row, enforces the credit limit on a 'charge',
-- writes a ledger row, and returns the new balance in cents.
create or replace function public.apply_house_account_delta(
  p_business_id uuid, p_customer_id uuid, p_delta_cents bigint, p_kind text,
  p_order_id uuid, p_note text default null
) returns bigint
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare
  v_enabled boolean;
  v_limit bigint;
  v_balance bigint;
begin
  if not exists (select 1 from business_members where business_id = p_business_id and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if p_kind not in ('charge','payment','adjust') then
    raise exception 'Invalid kind';
  end if;
  select enabled, limit_cents, balance_cents into v_enabled, v_limit, v_balance
    from house_accounts where business_id = p_business_id and customer_id = p_customer_id for update;
  if not found then
    if p_kind = 'charge' then
      raise exception 'No house account for this customer';
    end if;
    insert into house_accounts (business_id, customer_id, enabled, balance_cents)
      values (p_business_id, p_customer_id, true, 0)
      returning enabled, limit_cents, balance_cents into v_enabled, v_limit, v_balance;
  end if;
  if p_kind = 'charge' then
    if not v_enabled then raise exception 'House account is disabled for this customer'; end if;
    if v_limit is not null and (v_balance + p_delta_cents) > v_limit then
      raise exception 'Over the house-account credit limit';
    end if;
  end if;
  update house_accounts
    set balance_cents = balance_cents + p_delta_cents, updated_at = now()
    where business_id = p_business_id and customer_id = p_customer_id
    returning balance_cents into v_balance;
  insert into house_account_ledger (business_id, customer_id, order_id, delta_cents, kind, note, created_by)
    values (p_business_id, p_customer_id, p_order_id, p_delta_cents, p_kind, p_note, auth.uid());
  return v_balance;
end;
$$;
