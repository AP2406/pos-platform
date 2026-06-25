-- GAP-1 (3/5): QR order & pay at table. Two anon-callable SECURITY DEFINER RPCs:
--   get_guest_check     — the table's current check + the tax metadata the server
--                         needs to recompute an authoritative total (read-only).
--   settle_guest_check  — after a successful Finix charge, record the sale by
--                         calling the SAME money RPC the register uses
--                         (create_pos_order) so there is ONE order-creation path;
--                         then tag it channel='qr', record the Finix payment, and
--                         close the table (mirrors closeTableTicket).
-- No tax math is duplicated in SQL: the server computes tax via the shared TS
-- helper (lib/services/tax-compute) from the metadata this RPC returns.

-- The current open check for a table + the per-item tax metadata + rate table.
create or replace function public.get_guest_check(p_business_id uuid, p_element_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_biz record;
  v_ticket record;
  v_items jsonb;
  v_rates jsonb;
  v_card_live boolean;
begin
  select name,
         coalesce(guest_ordering_enabled, false) as enabled,
         coalesce(is_demo, false) as demo,
         coalesce(training_mode, false) as training,
         finix_merchant_id,
         finix_merchant_state,
         coalesce(default_tax_rate, 0) as default_tax_rate
    into v_biz from businesses where id = p_business_id;
  if v_biz.name is null then return jsonb_build_object('found', false); end if;

  v_card_live := v_biz.finix_merchant_id is not null
                 and upper(coalesce(v_biz.finix_merchant_state, '')) = 'APPROVED'
                 and not v_biz.demo and not v_biz.training;

  select id, label, cart into v_ticket
    from open_tickets
   where business_id = p_business_id and element_id = p_element_id and ticket_type = 'table'
   order by opened_at desc limit 1;

  if v_ticket.id is null then
    return jsonb_build_object('found', true, 'enabled', v_biz.enabled, 'open', false,
                              'business_name', v_biz.name, 'card_live', v_card_live);
  end if;

  -- Cart lines joined to their catalog item for current tax metadata. Voided
  -- lines are excluded from what the guest pays.
  select coalesce(jsonb_agg(jsonb_build_object(
           'catalog_item_id', ci.id,
           'name', coalesce(e->>'name', ci.name),
           'unit_price', coalesce((e->>'unit_price')::numeric, ci.price, 0),
           'quantity', coalesce((e->>'quantity')::int, 1),
           'taxable', coalesce(ci.taxable, true),
           'tax_rate_id', ci.tax_rate_id
         )), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
    left join catalog_items ci on ci.id = nullif(e->>'catalog_item_id','')::uuid and ci.business_id = p_business_id
   where coalesce((e->>'void')::boolean, false) = false;

  select coalesce(jsonb_agg(distinct jsonb_build_object('id', tr.id, 'name', tr.name, 'rate', tr.rate)), '[]'::jsonb)
    into v_rates
    from tax_rates tr
   where tr.business_id = p_business_id
     and tr.id in (
       select ci.tax_rate_id
         from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
         join catalog_items ci on ci.id = nullif(e->>'catalog_item_id','')::uuid
        where ci.tax_rate_id is not null and ci.business_id = p_business_id
     );

  return jsonb_build_object(
    'found', true, 'enabled', v_biz.enabled, 'open', true,
    'business_name', v_biz.name, 'table_label', v_ticket.label,
    'default_tax_rate', v_biz.default_tax_rate,
    'card_live', v_card_live,
    'merchant_id', case when v_card_live then v_biz.finix_merchant_id else null end,
    'items', v_items, 'rates', v_rates
  );
end $$;
grant execute on function public.get_guest_check(uuid, uuid) to anon, authenticated;

-- Record a guest's at-table card payment as a paid sale + close the table. The
-- charge already succeeded at Finix (the server passes the transfer); the amounts
-- are the server-authoritative ones computed via the shared tax helper.
create or replace function public.settle_guest_check(
  p_business_id uuid,
  p_element_id uuid,
  p_subtotal numeric,
  p_tax numeric,
  p_tip numeric,
  p_total numeric,
  p_tax_breakdown jsonb,
  p_transfer_id text,
  p_payment_instrument_id text,
  p_merchant_id text,
  p_amount_cents integer,
  p_currency text,
  p_idem text
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_enabled boolean;
  v_ticket record;
  v_items jsonb;
  v_payload jsonb;
  v_res jsonb;
  v_order_id uuid;
begin
  select coalesce(guest_ordering_enabled, false) into v_enabled from businesses where id = p_business_id;
  if not coalesce(v_enabled, false) then raise exception 'guest_ordering_disabled'; end if;

  select id, element_id, cart into v_ticket
    from open_tickets
   where business_id = p_business_id and element_id = p_element_id and ticket_type = 'table'
   order by opened_at desc limit 1
   for update;
  if v_ticket.id is null then raise exception 'no_open_check'; end if;

  -- Cart -> create_pos_order items (skip voids), at the prices on the check.
  select coalesce(jsonb_agg(jsonb_build_object(
           'catalog_item_id', nullif(e->>'catalog_item_id',''),
           'name', coalesce(e->>'name', 'Item'),
           'unit_price', coalesce((e->>'unit_price')::numeric, 0),
           'quantity', coalesce((e->>'quantity')::int, 1)
         )), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
   where coalesce((e->>'void')::boolean, false) = false;

  -- Reuse the register's money RPC so there is one audited order-creation path.
  v_payload := jsonb_build_object(
    'business_id', p_business_id,
    'status', 'paid',
    'subtotal', p_subtotal, 'tax', p_tax, 'tip', p_tip, 'total', p_total,
    'payment_method', 'card',
    'idempotency_key', p_idem,
    'snapshot', jsonb_build_object(
      'tax', jsonb_build_object('breakdown', coalesce(p_tax_breakdown, '[]'::jsonb), 'taxable_base', p_subtotal),
      'channel', 'qr', 'guest_pay', true, 'element_id', p_element_id
    ),
    'items', v_items,
    'payments', jsonb_build_array(jsonb_build_object(
      'method', 'card', 'amount', p_total, 'tender_type', 'card',
      'finix_transfer_id', p_transfer_id, 'finix_state', 'SUCCEEDED'
    )),
    'audit_events', jsonb_build_array(jsonb_build_object(
      'action', 'guest_pay', 'actor_role', 'guest',
      'metadata', jsonb_build_object('element_id', p_element_id, 'transfer_id', p_transfer_id)
    ))
  );

  v_res := public.create_pos_order(v_payload);
  v_order_id := nullif(v_res->>'order_id','')::uuid;

  -- Tag the channel (create_pos_order doesn't take it) + record the Finix payment.
  update orders set channel = 'qr' where id = v_order_id and business_id = p_business_id;

  if not exists (select 1 from finix_payments where finix_transfer_id = p_transfer_id) then
    insert into finix_payments (business_id, order_id, finix_transfer_id, finix_payment_instrument_id,
                                finix_merchant_id, amount_cents, currency, status)
    values (p_business_id, v_order_id, p_transfer_id, nullif(p_payment_instrument_id,''),
            nullif(p_merchant_id,''), p_amount_cents, coalesce(nullif(p_currency,''),'CAD'), 'succeeded');
  end if;

  -- Close the table: clear its kitchen tickets + drop the open check (mirrors
  -- closeTableTicket). Only on a fresh settle, not an idempotent replay.
  if coalesce((v_res->>'replayed')::boolean, false) = false then
    update kitchen_tickets set fulfilled_at = now()
      where business_id = p_business_id and element_id = p_element_id and fulfilled_at is null;
    delete from open_tickets where id = v_ticket.id and business_id = p_business_id;
  end if;

  return jsonb_build_object('ok', true, 'order_id', v_order_id, 'sale_number', v_res->>'sale_number');
end $$;
grant execute on function public.settle_guest_check(uuid, uuid, numeric, numeric, numeric, numeric, jsonb, text, text, text, integer, text, text) to anon, authenticated;
