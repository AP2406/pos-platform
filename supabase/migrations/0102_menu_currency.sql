-- The merchant's currency, on the surfaces a GUEST sees.
--
-- 0101 gave guest menus descriptions and photos. This one stops them being
-- priced in dollars regardless of where the restaurant is.
--
-- The till, the drawer and the printed receipt were fixed earlier today (see
-- @surge/api-contracts money.ts) — the guest side was not, so a café in Colombo
-- would have shown a guest a lovingly written description next to a dollar sign,
-- on the QR menu, the kiosk, online ordering, the menu board and the
-- customer-facing display.
--
-- It has to come through the RPC rather than a second query: these are public
-- pages served to `anon`, businesses is behind RLS, and these security-definer
-- functions are precisely the sanctioned way for an unauthenticated guest to
-- learn anything about the business. Returning currency alongside business_name
-- costs one column on a query that already reads that row.
--
-- Bodies are 0101's verbatim with `currency` added to the SELECT and to the
-- returned object. The catalog_available_now() dayparting filter and the
-- description/image_url projection both carry over unchanged.

create or replace function public.get_kiosk_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_items jsonb;
begin
  select name, coalesce(kiosk_ordering_enabled, false) as enabled,
         coalesce(currency, 'CAD') as currency
    into v_biz from businesses where id = p_business_id;
  if v_biz.name is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_biz.name,
    'enabled', v_biz.enabled, 'currency', v_biz.currency, 'items', v_items);
end $$;
grant execute on function public.get_kiosk_menu(uuid) to anon, authenticated;

create or replace function public.get_online_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_items jsonb;
begin
  select name, coalesce(online_ordering_enabled, false) as enabled,
         coalesce(currency, 'CAD') as currency
    into v_biz from businesses where id = p_business_id;
  if v_biz.name is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_biz.name,
    'enabled', v_biz.enabled, 'currency', v_biz.currency, 'items', v_items);
end $$;
grant execute on function public.get_online_menu(uuid) to anon, authenticated;

create or replace function public.get_guest_menu(p_business_id uuid, p_element_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_label text;
  v_has_ticket boolean;
  v_items jsonb;
begin
  select name, coalesce(guest_ordering_enabled, false) as enabled,
         coalesce(currency, 'CAD') as currency
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
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object(
    'found', true, 'business_name', v_biz.name, 'enabled', v_biz.enabled,
    'currency', v_biz.currency,
    'table_label', v_label, 'open', v_has_ticket, 'items', v_items
  );
end $$;
grant execute on function public.get_guest_menu(uuid, uuid) to anon, authenticated;

create or replace function public.get_public_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_name text;
  v_currency text;
  v_items jsonb;
begin
  select name, coalesce(currency, 'CAD') into v_name, v_currency
    from businesses where id = p_business_id;
  if v_name is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name, 'price', price, 'category', category,
           'out_of_stock', coalesce(out_of_stock, false),
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_name,
    'currency', v_currency, 'items', v_items);
end $$;
grant execute on function public.get_public_menu(uuid) to anon, authenticated;
