-- GAP-1 (1/5): order channel foundation. Every check/order can carry the channel
-- it originated from so the KDS, Orders, and reports can distinguish in-store from
-- online / QR / kiosk / delivery. Additive and behavior-preserving: a NULL channel
-- means in-store (the register), exactly as today.
--
--   open_tickets.channel — set when a non-POS surface opens the check
--                          ('kiosk' today; 'online' / 'qr' / a delivery platform
--                          slug as later GAP-1 chunks land).
--   orders.channel       — copied from the closing ticket at sale time (in the
--                          server action, alongside guest_count). NULL = in-store.
--
-- The money RPC (create_pos_order) is intentionally NOT changed — channel is set
-- post-insert from the ticket, so the audited charge path is untouched.

alter table public.open_tickets add column if not exists channel text;
alter table public.orders       add column if not exists channel text;

-- Kiosk self-orders now tag their togo check as 'kiosk' (only line changed below
-- is the open_tickets insert). Everything else matches 0034.
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

  insert into public.open_tickets (business_id, ticket_type, label, cart, guest_count, channel, opened_at, updated_at)
  values (p_business_id, 'togo', v_label,
          jsonb_build_object('items', v_cart_items), 1, 'kiosk', now(), now())
  returning id into v_ticket_id;

  -- Fire to the kitchen (KDS) immediately.
  insert into public.kitchen_tickets (business_id, element_id, label, items, fired_at)
  values (p_business_id, null, v_label, v_kds_items, now());

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket_id, 'label', v_label, 'count', v_count);
end $$;
grant execute on function public.submit_kiosk_order(uuid, text, jsonb) to anon, authenticated;
