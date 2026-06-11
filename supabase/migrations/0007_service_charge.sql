-- Service charge / auto-gratuity — Pass C feature 2. Additive.
-- A configurable percentage charge that can auto-apply for large parties.
-- The charge is NOT itself taxed; its base is the pre-tax net (default) or the
-- post-tax amount, per `service_charge_post_tax`. Totals reconcile as:
--   total = (subtotal - discount - comp) + tax + service_charge + tip.
-- The authoritative amount is recomputed on the server from these settings; the
-- client only sends whether the charge is applied.

alter table public.businesses
  add column if not exists service_charge_enabled boolean not null default false,
  add column if not exists service_charge_pct numeric not null default 0,
  add column if not exists service_charge_auto_party integer not null default 0,
  add column if not exists service_charge_post_tax boolean not null default false,
  add column if not exists service_charge_label text not null default 'Service charge';

alter table public.orders
  add column if not exists service_charge numeric not null default 0;

-- Extend create_pos_order to persist service_charge (only addition vs 0006).
create or replace function public.create_pos_order(payload jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_business_id uuid := (payload->>'business_id')::uuid;
  v_idem text := nullif(payload->>'idempotency_key','');
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_sale_number bigint;
  v_allow_negative boolean;
  v_total numeric := coalesce((payload->>'total')::numeric, 0);
  v_snapshot jsonb := coalesce(payload->'snapshot', '{}'::jsonb);
  v_training boolean := coalesce((payload->>'is_training')::boolean, false);
  v_item jsonb;
  v_pay jsonb;
  v_ev jsonb;
  v_item_id uuid;
  v_qty integer;
  v_track boolean;
  v_new_qty numeric;
  v_pay_sum numeric := 0;
begin
  if v_business_id is null then
    raise exception 'missing_business';
  end if;

  if auth.uid() is not null and not exists (
    select 1 from public.business_members
    where business_id = v_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  if v_idem is not null then
    select * into v_existing from public.orders
      where business_id = v_business_id and idempotency_key = v_idem limit 1;
    if found then
      return jsonb_build_object('order_id', v_existing.id, 'sale_number', v_existing.sale_number, 'replayed', true);
    end if;
  end if;

  select coalesce(allow_negative_stock, false) into v_allow_negative
    from public.businesses where id = v_business_id;

  v_sale_number := public.next_sale_number(v_business_id);
  v_snapshot := v_snapshot || jsonb_build_object('sale_number', v_sale_number);

  insert into public.orders (
    business_id, status, subtotal, tax, tip, discount, comp, service_charge, total,
    payment_method, customer_id, sale_number, snapshot,
    drawer_session_id, is_training, idempotency_key, staff_id, tax_exempt, finix_transfer_id
  ) values (
    v_business_id, coalesce(payload->>'status','paid'),
    coalesce((payload->>'subtotal')::numeric,0), coalesce((payload->>'tax')::numeric,0),
    coalesce((payload->>'tip')::numeric,0), coalesce((payload->>'discount')::numeric,0),
    coalesce((payload->>'comp')::numeric,0), coalesce((payload->>'service_charge')::numeric,0), v_total,
    nullif(payload->>'payment_method',''), nullif(payload->>'customer_id','')::uuid,
    v_sale_number, v_snapshot, nullif(payload->>'drawer_session_id','')::uuid,
    v_training, v_idem, nullif(payload->>'staff_id','')::uuid,
    coalesce((payload->>'tax_exempt')::boolean,false), nullif(payload->>'finix_transfer_id','')
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'items','[]'::jsonb)) loop
    insert into public.order_items (order_id, business_id, catalog_item_id, name, unit_price, quantity)
    values (v_order_id, v_business_id, nullif(v_item->>'catalog_item_id','')::uuid,
            coalesce(v_item->>'name','Item'), coalesce((v_item->>'unit_price')::numeric,0),
            coalesce((v_item->>'quantity')::integer,1));

    v_item_id := nullif(v_item->>'catalog_item_id','')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer,1);

    if v_item_id is not null and not v_training then
      select coalesce(track_inventory,false) into v_track
        from public.catalog_items where id = v_item_id and business_id = v_business_id;
      if coalesce(v_track,false) then
        v_new_qty := public.apply_inventory_change(v_business_id, v_item_id, -v_qty, 'sale', null, v_order_id);
        if v_new_qty < 0 and not v_allow_negative then
          raise exception 'insufficient_stock:%', coalesce(v_item->>'name','item');
        end if;
      end if;
    end if;
  end loop;

  for v_pay in select * from jsonb_array_elements(coalesce(payload->'payments','[]'::jsonb)) loop
    insert into public.payments (business_id, order_id, method, amount, tendered, change_given, tender_type, finix_transfer_id, finix_state)
    values (v_business_id, v_order_id, coalesce(v_pay->>'method','cash'),
            coalesce((v_pay->>'amount')::numeric,0), nullif(v_pay->>'tendered','')::numeric,
            nullif(v_pay->>'change_given','')::numeric, nullif(v_pay->>'tender_type',''),
            nullif(v_pay->>'finix_transfer_id',''), nullif(v_pay->>'finix_state',''));
    v_pay_sum := v_pay_sum + coalesce((v_pay->>'amount')::numeric,0);
  end loop;

  if v_pay_sum < v_total - 0.01 then
    raise exception 'tender_short';
  end if;

  for v_ev in select * from jsonb_array_elements(coalesce(payload->'audit_events','[]'::jsonb)) loop
    insert into public.audit_events (business_id, actor_id, actor_role, action, order_id, reason_code, reason_note, metadata)
    values (v_business_id, nullif(v_ev->>'actor_id','')::uuid, v_ev->>'actor_role', v_ev->>'action',
            v_order_id, nullif(v_ev->>'reason_code',''), nullif(v_ev->>'reason_note',''),
            coalesce(v_ev->'metadata','{}'::jsonb));
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'sale_number', v_sale_number, 'replayed', false);
end;
$function$;
