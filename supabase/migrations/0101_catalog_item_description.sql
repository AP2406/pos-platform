-- Item descriptions, and getting them to the people who need them.
--
-- WHY. A Surge catalog item had a name, a price and a photo, and nothing else a
-- guest could read. That is fine when a server is standing there to answer
-- "what's in the nachos" — and it is the entire problem on the three surfaces
-- where nobody is: the QR menu at the table, the kiosk, and online ordering.
-- On a self-ordering screen the description IS the server, and we were sending
-- guests "Nachos — $13.99" and hoping.
--
-- Found by putting TouchBistro's guest-facing Menu screen next to ours: theirs
-- lists every item with a full description under the name.
--
-- Two columns of payload, not one. `image_url` already existed on catalog_items
-- and none of the four menu functions returned it either, so every guest menu
-- was text-only while the register showed photos.

alter table public.catalog_items
  add column if not exists description text;

comment on column public.catalog_items.description is
  'Guest-facing item description shown on the QR menu, kiosk and online ordering. Not shown on the register, which is for staff who already know the menu.';

-- The four customer-facing menu sources. Each body below is 0075''s verbatim —
-- including the catalog_available_now() dayparting filter, which must not be
-- lost here: without it an off-hours item reappears on every guest menu — with
-- `description` and `image_url` added to the item projection and nothing else
-- changed.

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
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_biz.name, 'enabled', v_biz.enabled, 'items', v_items);
end $$;
grant execute on function public.get_kiosk_menu(uuid) to anon, authenticated;

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
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_biz.name, 'enabled', v_biz.enabled, 'items', v_items);
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
           'id', id, 'name', name, 'price', price, 'category', category,
           'description', description, 'image_url', image_url
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true and coalesce(out_of_stock, false) = false
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object(
    'found', true, 'business_name', v_biz.name, 'enabled', v_biz.enabled,
    'table_label', v_label, 'open', v_has_ticket, 'items', v_items
  );
end $$;
grant execute on function public.get_guest_menu(uuid, uuid) to anon, authenticated;

create or replace function public.get_public_menu(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_name text;
  v_items jsonb;
begin
  select name into v_name from businesses where id = p_business_id;
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

  return jsonb_build_object('found', true, 'business_name', v_name, 'items', v_items);
end $$;
grant execute on function public.get_public_menu(uuid) to anon, authenticated;
