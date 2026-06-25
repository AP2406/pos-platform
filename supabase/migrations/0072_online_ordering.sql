-- GAP-1 (2/5): commission-free online pickup ordering. A public /order/<businessId>
-- page lets a customer build an order off the live catalog and send it straight to
-- the kitchen as a togo check tagged channel='online' (GAP-1 chunk 1). Like the
-- kiosk (0034) there is no online payment in this chunk — the guest pays at pickup;
-- staff ring up the togo check at the register. Opt-in per business, anon-callable
-- SECURITY DEFINER so RLS stays closed.
alter table public.businesses
  add column if not exists online_ordering_enabled boolean not null default false;

-- Public menu for the online-ordering page. Mirrors get_kiosk_menu but gated on
-- online_ordering_enabled. Active, in-stock items only.
create or replace function public.get_online_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_items jsonb;
begin
  select name, coalesce(online_ordering_enabled, false) as enabled
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
grant execute on function public.get_online_menu(uuid) to anon, authenticated;

-- Place an online pickup order. Creates a pre-fired togo check (channel='online')
-- with the guest's name + phone for pickup, and fires it to the kitchen. Same shape
-- as submit_kiosk_order; the only additions are the phone, the optional note, and
-- the 'online' channel tag.
create or replace function public.submit_online_order(
  p_business_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_enabled boolean;
  v_name text;
  v_phone text;
  v_note text;
  v_label text;
  v_kds_label text;
  v_cart_items jsonb := '[]'::jsonb;
  v_kds_items jsonb := '[]'::jsonb;
  v_count int := 0;
  v_ticket_id uuid;
  it jsonb;
  v_item record;
  v_qty int;
  v_line_note text;
begin
  select coalesce(online_ordering_enabled, false) into v_enabled from businesses where id = p_business_id;
  if not coalesce(v_enabled, false) then raise exception 'online_ordering_disabled'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;

  v_name := nullif(left(trim(coalesce(p_customer_name, '')), 40), '');
  v_phone := nullif(left(trim(coalesce(p_customer_phone, '')), 30), '');
  v_note := nullif(left(trim(coalesce(p_note, '')), 120), '');
  v_label := 'Online' || case when v_name is not null then ' · ' || v_name else '' end;
  v_kds_label := v_label || case when v_note is not null then ' — ' || v_note else '' end;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(20, coalesce((it->>'quantity')::int, 1)));
    select id, name, price, is_active, coalesce(out_of_stock, false) as oos
      into v_item from catalog_items
      where business_id = p_business_id and id = (it->>'catalog_item_id')::uuid;
    if v_item.id is null or not v_item.is_active or v_item.oos then continue; end if;
    v_line_note := case when length(coalesce(it->>'note','')) > 0 then left(it->>'note', 280) else null end;

    -- Pre-fired cart line (sent_qty = quantity) so staff don't re-fire.
    v_cart_items := v_cart_items || jsonb_build_object(
      'catalog_item_id', v_item.id, 'variation_id', null,
      'name', v_item.name, 'unit_price', v_item.price,
      'quantity', v_qty, 'sent_qty', v_qty,
      'note', v_line_note, 'seat', null, 'course_id', null,
      'fired_at', now(), 'online', true
    );
    v_kds_items := v_kds_items || jsonb_build_object(
      'name', v_item.name, 'quantity', v_qty, 'note', v_line_note
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'no_valid_items'; end if;

  insert into public.open_tickets (business_id, ticket_type, label, customer_phone, cart, guest_count, channel, opened_at, updated_at)
  values (p_business_id, 'togo', v_label, v_phone,
          jsonb_build_object('items', v_cart_items, 'online_note', v_note), 1, 'online', now(), now())
  returning id into v_ticket_id;

  -- Fire to the kitchen (KDS) immediately.
  insert into public.kitchen_tickets (business_id, element_id, label, items, fired_at)
  values (p_business_id, null, v_kds_label, v_kds_items, now());

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket_id, 'label', v_label, 'count', v_count);
end $$;
grant execute on function public.submit_online_order(uuid, text, text, jsonb, text) to anon, authenticated;
