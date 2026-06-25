-- GAP-1 (4/5): third-party delivery aggregation (DoorDash / Uber Eats / Grubhub).
-- A delivery order is ALREADY PAID through the platform, so we inject it as a PAID
-- order (not an open check that staff could ring up again): create_pos_order with a
-- 'delivery' tender records the revenue by channel and the KDS — which already
-- renders paid, unfulfilled orders — shows it with the platform badge (chunk 1).
-- There is no second register step and no double charge.
--
-- inject_delivery_order is SECURITY DEFINER + anon/authenticated-callable so the
-- webhook route (service role) and the owner test-order action can both reach it;
-- it is idempotent on (business, platform, external_id).

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform text not null,
  external_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  display_id text,
  created_at timestamptz not null default now(),
  unique (business_id, platform, external_id)
);

alter table public.delivery_orders enable row level security;

-- Members of the business can read its delivery-order log (ops visibility). Writes
-- go only through the SECURITY DEFINER RPC below.
drop policy if exists delivery_orders_select on public.delivery_orders;
create policy delivery_orders_select on public.delivery_orders
  for select using (
    exists (select 1 from public.business_members m
            where m.business_id = delivery_orders.business_id and m.user_id = auth.uid())
  );

create or replace function public.inject_delivery_order(
  p_business_id uuid,
  p_platform text,
  p_external_id text,
  p_display_id text,
  p_items jsonb,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_platform text;
  v_external text;
  v_existing record;
  v_items jsonb := '[]'::jsonb;
  v_count int := 0;
  v_subtotal numeric := 0;
  v_total numeric;
  v_payload jsonb;
  v_res jsonb;
  v_order_id uuid;
  it jsonb;
  v_qty int;
  v_price numeric;
begin
  if not exists (select 1 from businesses where id = p_business_id) then raise exception 'unknown_business'; end if;
  -- Normalise the platform to a known channel slug.
  v_platform := lower(coalesce(p_platform, ''));
  if v_platform not in ('doordash', 'ubereats', 'grubhub') then v_platform := 'delivery'; end if;
  v_external := nullif(trim(coalesce(p_external_id, '')), '');
  if v_external is null then raise exception 'missing_external_id'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'bad_items'; end if;

  -- Idempotent: a webhook retry returns the order already created.
  select * into v_existing from delivery_orders
    where business_id = p_business_id and platform = v_platform and external_id = v_external;
  if found then
    return jsonb_build_object('ok', true, 'order_id', v_existing.order_id, 'replayed', true);
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_qty := greatest(1, least(50, coalesce((it->>'quantity')::int, 1)));
    v_price := round(coalesce((it->>'unit_price')::numeric, 0), 2);
    v_items := v_items || jsonb_build_object(
      'catalog_item_id', null,
      'name', left(coalesce(it->>'name', 'Item'), 120),
      'unit_price', v_price,
      'quantity', v_qty
    );
    v_subtotal := v_subtotal + v_price * v_qty;
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'no_items'; end if;

  v_subtotal := round(coalesce(nullif(p_subtotal, 0), v_subtotal), 2);
  v_total := round(coalesce(nullif(p_total, 0), v_subtotal + coalesce(p_tax, 0)), 2);

  -- Record the (already-paid) sale through the shared money RPC. The tender is
  -- 'delivery' so reconciliation/tenders show it apart from cash and card.
  v_payload := jsonb_build_object(
    'business_id', p_business_id,
    'status', 'paid',
    'subtotal', v_subtotal, 'tax', coalesce(p_tax, 0), 'tip', 0, 'total', v_total,
    'payment_method', 'delivery',
    'idempotency_key', 'delivery:' || v_platform || ':' || v_external,
    'snapshot', jsonb_build_object('channel', v_platform, 'delivery',
      jsonb_build_object('platform', v_platform, 'external_id', v_external, 'display_id', p_display_id)),
    'items', v_items,
    'payments', jsonb_build_array(jsonb_build_object('method', 'delivery', 'amount', v_total, 'tender_type', 'external')),
    'audit_events', jsonb_build_array(jsonb_build_object('action', 'delivery_order', 'actor_role', 'system',
      'metadata', jsonb_build_object('platform', v_platform, 'external_id', v_external)))
  );

  v_res := public.create_pos_order(v_payload);
  v_order_id := nullif(v_res->>'order_id','')::uuid;
  update orders set channel = v_platform where id = v_order_id and business_id = p_business_id;

  insert into delivery_orders (business_id, platform, external_id, order_id, display_id)
  values (p_business_id, v_platform, v_external, v_order_id, nullif(p_display_id,''))
  on conflict (business_id, platform, external_id) do nothing;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'platform', v_platform, 'count', v_count);
end $$;
grant execute on function public.inject_delivery_order(uuid, text, text, text, jsonb, numeric, numeric, numeric) to anon, authenticated;
