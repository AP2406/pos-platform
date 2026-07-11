-- Owner/manager can set the next sale/bill number for their business
-- (TouchBistro "Current Order #" seed). Sets last_sale_number = p_seed - 1 so the
-- next next_sale_number() returns p_seed. Forward-only: the counter can't move
-- backwards, which would risk duplicate sale numbers on future orders.
create or replace function public.set_sale_number_seed(p_business_id uuid, p_seed bigint)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_current bigint;
begin
  if not exists (
    select 1 from business_members
    where business_id = p_business_id and user_id = auth.uid() and role in ('owner','manager')
  ) then
    raise exception 'Not allowed';
  end if;
  if p_seed is null or p_seed < 1 then
    raise exception 'Number must be 1 or greater';
  end if;
  select last_sale_number into v_current from order_counters where business_id = p_business_id;
  if v_current is not null and (p_seed - 1) < v_current then
    raise exception 'Number can''t go backwards (next is already %). Set a higher number.', v_current + 1;
  end if;
  insert into order_counters (business_id, last_sale_number)
  values (p_business_id, p_seed - 1)
  on conflict (business_id) do update set last_sale_number = p_seed - 1;
  return p_seed;
end;
$$;
