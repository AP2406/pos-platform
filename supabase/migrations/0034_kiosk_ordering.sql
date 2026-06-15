-- P3-44 Self-ordering kiosk. On-site consumer self-order → a NEW togo open ticket
-- (the check) + a kitchen ticket (the KDS). No table involved (unlike P2-27 guest
-- ordering, which appends to a table's existing check). No online payment — staff
-- charge at the counter; items are pre-fired so the kitchen starts immediately.
-- Opt-in per business. Anon-callable SECURITY DEFINER so RLS isn't opened up.
alter table public.businesses
  add column if not exists kiosk_ordering_enabled boolean not null default false;

create or replace function public.get_kiosk_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_items jsonb;
begin
  select name, coalesce(kiosk_ordering_enabled, false) as enabled
    into v_biz from businesses where id = p_business_id;
  if v_biz.name is null then
    return jsonb_build_object('found', false);
  end if;

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
    'items', v_items
  );
end $$;
grant execute on function public.get_kiosk_menu(uuid) to anon, authenticated;

create or replace function public.submit_kiosk_order(
  p_business_id uuid,
  p_customer_name text,
  p_items jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_enabled boolean;
  v_label text;
  v_cart_items jsonb := '[]'::jsonb;
  v_kds_items jsonb := '[]'::jsonb;
  v_count int := 0;
  v_ticket_id uuid;
  it jsonb;
  v_item record;
  v_qty int;
  v_note text;
begin
  select coalesce(kiosk_ordering_enabled, false) into v_enabled from businesses where id = p_business_id;
  if not coalesce(v_enabled, false) then raise exception 'kiosk_ordering_disabled'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;

  v_label := nullif(left(trim(coalesce(p_customer_name, '')), 40), '');
  v_label := 'Kiosk' || case when v_label is not null then ' · ' || v_label else '' end;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(20, coalesce((it->>'quantity')::int, 1)));
    select id, name, price, is_active, coalesce(out_of_stock, false) as oos
      into v_item from catalog_items
      where business_id = p_business_id and id = (it->>'catalog_item_id')::uuid;
    if v_item.id is null or not v_item.is_active or v_item.oos then continue; end if;
    v_note := case when length(coalesce(it->>'note','')) > 0 then left(it->>'note', 280) else null end;

    -- Cart line: pre-fired (sent_qty = quantity) so staff don't re-fire.
    v_cart_items := v_cart_items || jsonb_build_object(
      'catalog_item_id', v_item.id, 'variation_id', null,
      'name', v_item.name, 'unit_price', v_item.price,
      'quantity', v_qty, 'sent_qty', v_qty,
      'note', v_note, 'seat', null, 'course_id', null,
      'fired_at', now(), 'kiosk', true
    );
    v_kds_items := v_kds_items || jsonb_build_object(
      'name', v_item.name, 'quantity', v_qty, 'note', v_note
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'no_valid_items'; end if;

  insert into public.open_tickets (business_id, ticket_type, label, cart, guest_count, opened_at, updated_at)
  values (p_business_id, 'togo', v_label,
          jsonb_build_object('items', v_cart_items), 1, now(), now())
  returning id into v_ticket_id;

  -- Fire to the kitchen (KDS) immediately.
  insert into public.kitchen_tickets (business_id, element_id, label, items, fired_at)
  values (p_business_id, null, v_label, v_kds_items, now());

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket_id, 'label', v_label, 'count', v_count);
end $$;
grant execute on function public.submit_kiosk_order(uuid, text, jsonb) to anon, authenticated;
