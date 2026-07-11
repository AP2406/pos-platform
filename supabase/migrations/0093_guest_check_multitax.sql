-- Return per-item tax_rate_ids (multi-tax) so the QR guest-pay path charges the
-- same stacked tax the register would. Junction is source of truth; falls back to
-- the legacy single tax_rate_id for items with no junction rows.
--
-- MERGE-GATE: apply this before the multi-tax catalog editor (pos-parity-7) reaches
-- production. Without it, a guest paying by QR would be under-charged tax on any item
-- that has 2+ taxes assigned. (Items with a single tax are unaffected.)
create or replace function public.get_guest_check(p_business_id uuid, p_element_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
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

  -- Cart lines joined to their catalog item for current tax metadata. tax_rate_ids
  -- comes from the junction (fallback to the legacy single rate). Voided lines excluded.
  select coalesce(jsonb_agg(jsonb_build_object(
           'catalog_item_id', ci.id,
           'name', coalesce(e->>'name', ci.name),
           'unit_price', coalesce((e->>'unit_price')::numeric, ci.price, 0),
           'quantity', coalesce((e->>'quantity')::int, 1),
           'taxable', coalesce(ci.taxable, true),
           'tax_rate_id', ci.tax_rate_id,
           'tax_rate_ids', coalesce(
             (select array_agg(cit.tax_rate_id) from catalog_item_taxes cit where cit.catalog_item_id = ci.id),
             case when ci.tax_rate_id is not null then array[ci.tax_rate_id] else array[]::uuid[] end
           )
         )), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
    left join catalog_items ci on ci.id = nullif(e->>'catalog_item_id','')::uuid and ci.business_id = p_business_id
   where coalesce((e->>'void')::boolean, false) = false;

  -- All rates referenced by the cart's items (junction + legacy fallback).
  select coalesce(jsonb_agg(distinct jsonb_build_object('id', tr.id, 'name', tr.name, 'rate', tr.rate)), '[]'::jsonb)
    into v_rates
    from tax_rates tr
   where tr.business_id = p_business_id
     and tr.id in (
       select cit.tax_rate_id
         from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
         join catalog_items ci on ci.id = nullif(e->>'catalog_item_id','')::uuid and ci.business_id = p_business_id
         join catalog_item_taxes cit on cit.catalog_item_id = ci.id
        where coalesce((e->>'void')::boolean, false) = false
       union
       select ci.tax_rate_id
         from jsonb_array_elements(coalesce(v_ticket.cart->'items', '[]'::jsonb)) e
         join catalog_items ci on ci.id = nullif(e->>'catalog_item_id','')::uuid and ci.business_id = p_business_id
        where coalesce((e->>'void')::boolean, false) = false
          and ci.tax_rate_id is not null
          and not exists (select 1 from catalog_item_taxes cit where cit.catalog_item_id = ci.id)
     );

  return jsonb_build_object(
    'found', true, 'enabled', v_biz.enabled, 'open', true,
    'business_name', v_biz.name, 'table_label', v_ticket.label,
    'default_tax_rate', v_biz.default_tax_rate,
    'card_live', v_card_live,
    'merchant_id', case when v_card_live then v_biz.finix_merchant_id else null end,
    'items', v_items, 'rates', v_rates
  );
end $function$;
