-- P3-37b Receiving: post a sent PO's stock into inventory, atomically.
-- One line may target an ingredient (apply_ingredient_change) or a catalog item
-- (apply_inventory_change); both write their own ledger with reason 'receive'.
-- p_receipts is a JSON object mapping po_line id -> received quantity; a line
-- absent from the map defaults to its ordered quantity. Whole thing runs in one
-- transaction (the function body), so a mid-way failure rolls back cleanly.

create or replace function public.receive_purchase_order(
  p_po_id uuid,
  p_business_id uuid,
  p_receipts jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status text;
  v_line public.po_lines%rowtype;
  v_recv numeric;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  select status into v_status from public.purchase_orders
    where id = p_po_id and business_id = p_business_id;
  if v_status is null then
    raise exception 'po_not_found';
  end if;
  if v_status = 'received' then
    raise exception 'already_received';
  end if;
  if v_status = 'cancelled' then
    raise exception 'po_cancelled';
  end if;

  for v_line in
    select * from public.po_lines where po_id = p_po_id and business_id = p_business_id
  loop
    v_recv := coalesce((p_receipts->>v_line.id::text)::numeric, v_line.quantity);
    if v_recv is not null and v_recv > 0 then
      if v_line.ingredient_id is not null then
        perform public.apply_ingredient_change(
          p_business_id, v_line.ingredient_id, v_recv, 'receive', null, null);
      elsif v_line.catalog_item_id is not null then
        perform public.apply_inventory_change(
          p_business_id, v_line.catalog_item_id, v_recv, 'receive', null, null);
      end if;
    end if;
    update public.po_lines set received_qty = coalesce(v_recv, 0) where id = v_line.id;
  end loop;

  update public.purchase_orders
    set status = 'received', received_at = now()
    where id = p_po_id and business_id = p_business_id;
end $$;
