-- P2-32 gift cards (cross-vertical). Balance is REAL money kept in integer cents
-- with an append-only ledger (issue/reload/redeem, signed). Redemption (P2-32b)
-- becomes a payments tender. A DB function applies deltas atomically so the
-- balance and ledger can never diverge.
create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  balance_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);
create index if not exists gift_cards_business_idx on public.gift_cards(business_id);

create table if not exists public.gift_card_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  delta_cents integer not null,     -- signed: +issue/reload, -redeem
  kind text not null,               -- 'issue' | 'reload' | 'redeem' | 'adjust'
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gift_card_ledger_card_idx on public.gift_card_ledger(gift_card_id);

alter table public.gift_cards enable row level security;
alter table public.gift_card_ledger enable row level security;

drop policy if exists gc_select on public.gift_cards;
create policy gc_select on public.gift_cards for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists gc_insert on public.gift_cards;
create policy gc_insert on public.gift_cards for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists gc_update on public.gift_cards;
create policy gc_update on public.gift_cards for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

drop policy if exists gcl_select on public.gift_card_ledger;
create policy gcl_select on public.gift_card_ledger for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists gcl_insert on public.gift_card_ledger;
create policy gcl_insert on public.gift_card_ledger for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Apply a signed delta to a card atomically: append a ledger row and move the
-- balance in one statement, rejecting overdrafts. SECURITY DEFINER + an explicit
-- membership check so the balance and ledger stay in lockstep under concurrency.
create or replace function public.apply_gift_card_delta(
  p_business_id uuid,
  p_gift_card_id uuid,
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

  select balance_cents into v_balance
  from gift_cards
  where id = p_gift_card_id and business_id = p_business_id and is_active
  for update;
  if not found then
    raise exception 'gift_card_not_found';
  end if;

  if v_balance + p_delta_cents < 0 then
    raise exception 'insufficient_balance';
  end if;

  update gift_cards
    set balance_cents = balance_cents + p_delta_cents, updated_at = now()
    where id = p_gift_card_id;

  insert into gift_card_ledger (business_id, gift_card_id, delta_cents, kind, order_id)
    values (p_business_id, p_gift_card_id, p_delta_cents, p_kind, p_order_id);

  return v_balance + p_delta_cents;
end $$;
