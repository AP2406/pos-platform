-- GAP-3 (1/5): menu dayparting / scheduled menus. An availability window restricts
-- an item (or a whole category) to recurring local-time windows on chosen days —
-- e.g. the breakfast category only 6:00–11:00, dinner items only after 16:00. The
-- shape mirrors price_windows (0061): days 0=Sun..6=Sat (empty=every day), minutes
-- from local midnight, item- or category-scoped.
--
-- DEFAULT PRESERVES TODAY'S BEHAVIOR: an item with NO window targeting it (or its
-- category) is always available. Only items that have a window are time-gated, and
-- only outside all their windows.

create table if not exists public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null default 'Menu hours',
  scope text not null default 'item',              -- item | category
  target_item_id uuid references public.catalog_items(id) on delete cascade,
  target_category text,
  days smallint[] not null default '{}',           -- 0=Sun..6=Sat; empty = every day
  start_min integer not null default 0,            -- minutes from local midnight
  end_min integer not null default 1440,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists availability_windows_business_idx on public.availability_windows(business_id, active);

alter table public.availability_windows enable row level security;
drop policy if exists availability_windows_select on public.availability_windows;
create policy availability_windows_select on public.availability_windows for select
  using (exists (select 1 from public.business_members m where m.business_id = availability_windows.business_id and m.user_id = auth.uid()));
drop policy if exists availability_windows_write on public.availability_windows;
create policy availability_windows_write on public.availability_windows for all
  using (exists (select 1 from public.business_members m where m.business_id = availability_windows.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = availability_windows.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

-- Is an item available right now, in the business's local time? True when no window
-- targets it/its category; otherwise true only inside a matching active window.
create or replace function public.catalog_available_now(p_business_id uuid, p_item_id uuid, p_category text)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  with lt as (
    select (now() at time zone coalesce((select timezone from businesses where id = p_business_id), 'America/Toronto')) as ts
  ),
  cur as (
    select extract(dow from (select ts from lt))::int as dow,
           (extract(hour from (select ts from lt)) * 60 + extract(minute from (select ts from lt)))::int as min
  ),
  wins as (
    select w.* from availability_windows w
     where w.business_id = p_business_id and w.active
       and ( (w.scope = 'item' and w.target_item_id = p_item_id)
          or (w.scope = 'category' and w.target_category is not null and coalesce(p_category, '') = w.target_category) )
  )
  select case
    when not exists (select 1 from wins) then true
    else exists (
      select 1 from wins w, cur
       where (coalesce(array_length(w.days, 1), 0) = 0 or cur.dow = any(w.days))
         and ( w.start_min = w.end_min
            or (w.end_min > w.start_min and cur.min >= w.start_min and cur.min < w.end_min)
            or (w.end_min < w.start_min and (cur.min >= w.start_min or cur.min < w.end_min)) )
    )
  end;
$$;
grant execute on function public.catalog_available_now(uuid, uuid, text) to anon, authenticated;

-- Patch the four customer-facing menu sources to hide items that aren't available
-- right now. Each is the original body (0024/0026/0034/0072) plus the availability
-- filter on the item SELECT.

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
           'id', id, 'name', name, 'price', price, 'category', category
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
           'id', id, 'name', name, 'price', price, 'category', category
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
           'out_of_stock', coalesce(out_of_stock, false)
         ) order by category nulls last, name), '[]'::jsonb)
    into v_items
    from catalog_items
    where business_id = p_business_id and is_active = true
      and public.catalog_available_now(p_business_id, id, category);

  return jsonb_build_object('found', true, 'business_name', v_name, 'items', v_items);
end $$;
grant execute on function public.get_public_menu(uuid) to anon, authenticated;
