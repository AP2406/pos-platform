-- Track-my-order: let an online-pickup guest watch their order go
--   preparing -> ready -> completed
-- on a public page, WITHOUT any login, PII, or money data.
--
-- Security model (this is a public, anon-callable surface):
--   * The only key is an opaque random uuid (`public_token`) stamped on the
--     order's open_ticket + kitchen_ticket when the order is placed. 122 bits of
--     entropy => unguessable, no enumeration (the RPC takes ONLY the token).
--   * get_order_status returns ONLY: derived status, placed-at time, the shop's
--     public display name, and the guest's own item names+quantities. It exposes
--     NO customer name/phone/note, NO prices/amounts, and NO row ids.
--
-- Additive + forward-only: existing rows keep public_token = null (only NEW online
-- orders get a token and a track link); nothing about the register/money path
-- changes.

alter table public.open_tickets    add column if not exists public_token uuid;
alter table public.kitchen_tickets  add column if not exists public_token uuid;

-- Partial unique on open_tickets so a token resolves to exactly one live ticket;
-- kitchen_tickets is lookup-only (persists after bump), so a plain partial index.
create unique index if not exists open_tickets_public_token_uniq
  on public.open_tickets(public_token) where public_token is not null;
create index if not exists kitchen_tickets_public_token_idx
  on public.kitchen_tickets(public_token) where public_token is not null;

-- Re-create submit_online_order (0072) unchanged except: mint a per-order token,
-- stamp it on both the open_ticket and the kitchen_ticket, and return it so the
-- confirmation screen can link the guest to their tracker.
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
  v_token uuid := gen_random_uuid();
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

  insert into public.open_tickets (business_id, ticket_type, label, customer_phone, cart, guest_count, channel, opened_at, updated_at, public_token)
  values (p_business_id, 'togo', v_label, v_phone,
          jsonb_build_object('items', v_cart_items, 'online_note', v_note), 1, 'online', now(), now(), v_token)
  returning id into v_ticket_id;

  -- Fire to the kitchen (KDS) immediately.
  insert into public.kitchen_tickets (business_id, element_id, label, items, fired_at, public_token)
  values (p_business_id, null, v_kds_label, v_kds_items, now(), v_token);

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket_id, 'label', v_label, 'count', v_count, 'token', v_token);
end $$;
grant execute on function public.submit_online_order(uuid, text, text, jsonb, text) to anon, authenticated;

-- Public, anon-callable order status by opaque token. Returns the minimum a guest
-- needs to watch their pickup order — and nothing more (no PII, no money, no ids).
--   preparing : kitchen has it, not bumped yet
--   ready     : bumped on the KDS, ticket still open (not yet collected)
--   completed : the ticket was rung up / closed (picked up)
create or replace function public.get_order_status(p_token uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_kt record;
  v_biz_name text;
  v_open boolean;
  v_status text;
  v_items jsonb;
begin
  if p_token is null then
    return jsonb_build_object('found', false);
  end if;

  select business_id, fired_at, fulfilled_at
    into v_kt
    from kitchen_tickets
    where public_token = p_token
    limit 1;

  if v_kt.business_id is null then
    return jsonb_build_object('found', false);
  end if;

  select name into v_biz_name from businesses where id = v_kt.business_id;
  select exists(select 1 from open_tickets where public_token = p_token) into v_open;

  if not v_open then
    v_status := 'completed';
  elsif v_kt.fulfilled_at is not null then
    v_status := 'ready';
  else
    v_status := 'preparing';
  end if;

  -- Guest's own items: name + quantity ONLY. No prices, no line notes (which can
  -- carry free-text PII), no customer contact.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', elem->>'name',
           'quantity', greatest(1, coalesce((elem->>'quantity')::int, 1))
         )), '[]'::jsonb)
    into v_items
    from kitchen_tickets kt, jsonb_array_elements(kt.items) elem
    where kt.public_token = p_token;

  return jsonb_build_object(
    'found', true,
    'status', v_status,
    'placed_at', v_kt.fired_at,
    'business_name', coalesce(v_biz_name, 'Your order'),
    'items', v_items
  );
end $$;
grant execute on function public.get_order_status(uuid) to anon, authenticated;
