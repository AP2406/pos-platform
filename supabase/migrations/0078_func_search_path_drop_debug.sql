-- Go-live hardening P1: pin a non-mutable search_path on advisor-flagged functions
-- (function_search_path_mutable) and drop dev-only debug helpers.
--
-- Functions with no table references just get SET search_path = ''. The three that
-- touch public tables are recreated with schema-qualified names so an empty
-- search_path can't break them. Bodies are otherwise byte-for-byte the originals.

-- No-table trigger functions: pin search_path only.
alter function public.auto_86_on_stock() set search_path = '';
alter function public.guard_paid_order_financials() set search_path = '';
alter function public.guard_z_report_immutable() set search_path = '';

-- Table-touching functions: schema-qualify internals + pin search_path.
create or replace function public.next_sale_number(p_business_id uuid)
 returns bigint
 language plpgsql
 set search_path = ''
as $function$
declare
  v_number bigint;
begin
  insert into public.order_counters (business_id, last_sale_number)
  values (p_business_id, 1)
  on conflict (business_id)
  do update set last_sale_number = public.order_counters.last_sale_number + 1
  returning last_sale_number into v_number;
  return v_number;
end;
$function$;

create or replace function public.apply_inventory_change(p_business_id uuid, p_item_id uuid, p_change numeric, p_reason text, p_note text, p_order_id uuid)
 returns numeric
 language plpgsql
 set search_path = ''
as $function$
declare
  v_new_qty numeric;
begin
  insert into public.inventory_movements (business_id, catalog_item_id, change, reason, note, order_id, created_by)
  values (p_business_id, p_item_id, p_change, p_reason, p_note, p_order_id, auth.uid());

  update public.catalog_items
  set stock_qty = stock_qty + p_change
  where id = p_item_id and business_id = p_business_id
  returning stock_qty into v_new_qty;

  return v_new_qty;
end;
$function$;

create or replace function public.set_inventory_count(p_business_id uuid, p_item_id uuid, p_counted numeric, p_note text)
 returns numeric
 language plpgsql
 set search_path = ''
as $function$
declare
  v_current numeric;
  v_variance numeric;
begin
  select stock_qty into v_current
  from public.catalog_items
  where id = p_item_id and business_id = p_business_id
  for update;

  if v_current is null then
    return null;
  end if;

  v_variance := p_counted - v_current;

  insert into public.inventory_movements (business_id, catalog_item_id, change, reason, note, order_id, created_by)
  values (p_business_id, p_item_id, v_variance, 'recount', p_note, null, auth.uid());

  update public.catalog_items
  set stock_qty = p_counted
  where id = p_item_id and business_id = p_business_id;

  return v_variance;
end;
$function$;

-- Dev-only helpers — should not exist in prod. No code/policy/trigger references.
drop function if exists public.debug_auth_uid();
drop function if exists public.debug_full_context();
