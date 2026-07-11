-- Capture how a house-account settlement was paid (cash/card/other) so it can be
-- posted to the GL (debit the tender received, credit AR). Adds a method column and
-- a p_method arg to the apply function.
alter table public.house_account_ledger add column if not exists method text;

drop function if exists public.apply_house_account_delta(uuid, uuid, bigint, text, uuid, text);
create or replace function public.apply_house_account_delta(
  p_business_id uuid, p_customer_id uuid, p_delta_cents bigint, p_kind text,
  p_order_id uuid, p_note text default null, p_method text default null
) returns bigint
language plpgsql security definer set search_path to 'public','extensions'
as $$
declare
  v_balance bigint;
begin
  if not exists (select 1 from business_members where business_id = p_business_id and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  if p_kind not in ('charge','payment','adjust') then
    raise exception 'Invalid kind';
  end if;
  select balance_cents into v_balance
    from house_accounts where business_id = p_business_id and customer_id = p_customer_id for update;
  if not found then
    insert into house_accounts (business_id, customer_id, enabled, balance_cents)
      values (p_business_id, p_customer_id, true, 0)
      returning balance_cents into v_balance;
  end if;
  if p_kind = 'payment' and (v_balance + p_delta_cents) < 0 then
    raise exception 'Payment exceeds the balance owed';
  end if;
  update house_accounts
    set balance_cents = balance_cents + p_delta_cents, updated_at = now()
    where business_id = p_business_id and customer_id = p_customer_id
    returning balance_cents into v_balance;
  insert into house_account_ledger (business_id, customer_id, order_id, delta_cents, kind, note, method, created_by)
    values (p_business_id, p_customer_id, p_order_id, p_delta_cents, p_kind, p_note, p_method, auth.uid());
  return v_balance;
end;
$$;
