-- P2-27 QR guest ordering (no online payment — orders land on the table's open
-- check for staff to review/fire/charge). Opt-in per business. Two anon-callable
-- SECURITY DEFINER functions wrap all access so RLS isn't opened up: one reads
-- the menu for a table, one appends a guest order to that table's OPEN ticket.
alter table public.businesses
  add column if not exists guest_ordering_enabled boolean not null default false;

create or replace function public.get_guest_menu(p_business_id uuid, p_element_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_label text;
  v_has_ticket boolean;
  v_items jsonb;
begin
  select name, coalesce(guest_ordering_enabled, false) as enabled
    into v_biz from businesses where id = p_business_id;
  if v_biz.name is null then
    return jsonb_build_object('found', false);
  end if;

  select label into v_label from floor_elements
    where id = p_element_id and business_id = p_business_id;

  select exists(
    select 1 from open_tickets
    where business_id = p_business_id and element_id = p_element_id and ticket_type = 'table'
  ) into v_has_ticket;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'price', price, 'category', category
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false;

  return jsonb_build_object(
    'found', true,
    'business_name', v_biz.name,
    'enabled', v_biz.enabled,
    'table_label', v_label,
    'open', v_has_ticket,
    'items', v_items
  );
end $$;
grant execute on function public.get_guest_menu(uuid, uuid) to anon, authenticated;

create or replace function public.submit_guest_order(p_business_id uuid, p_element_id uuid, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_enabled boolean;
  v_ticket_id uuid;
  v_cart jsonb;
  v_new jsonb := '[]'::jsonb;
  v_count int := 0;
  it jsonb;
  v_item record;
  v_qty int;
begin
  select coalesce(guest_ordering_enabled, false) into v_enabled from businesses where id = p_business_id;
  if not coalesce(v_enabled, false) then raise exception 'guest_ordering_disabled'; end if;

  select id, cart into v_ticket_id, v_cart
    from open_tickets
    where business_id = p_business_id and element_id = p_element_id and ticket_type = 'table'
    order by opened_at desc limit 1 for update;
  if v_ticket_id is null then raise exception 'no_open_ticket'; end if;

  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(20, coalesce((it->>'quantity')::int, 1)));
    select id, name, price, is_active, coalesce(out_of_stock, false) as oos
      into v_item from catalog_items
      where business_id = p_business_id and id = (it->>'catalog_item_id')::uuid;
    if v_item.id is null or not v_item.is_active or v_item.oos then continue; end if;
    v_new := v_new || jsonb_build_object(
      'catalog_item_id', v_item.id, 'variation_id', null,
      'name', v_item.name, 'unit_price', v_item.price,
      'quantity', v_qty, 'sent_qty', 0,
      'note', case when length(coalesce(it->>'note','')) > 0 then left(it->>'note', 280) else null end,
      'seat', null, 'course_id', null, 'fired_at', null, 'guest', true
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'no_valid_items'; end if;

  v_cart := jsonb_set(coalesce(v_cart, '{"items":[]}'::jsonb), '{items}',
                      coalesce(v_cart->'items', '[]'::jsonb) || v_new);
  update open_tickets set cart = v_cart, updated_at = now() where id = v_ticket_id;

  return jsonb_build_object('ok', true, 'added', v_count);
end $$;
grant execute on function public.submit_guest_order(uuid, uuid, jsonb) to anon, authenticated;
