-- P3-46 digital menu board. A public, read-only live menu for a TV/web display.
-- Anon-callable SECURITY DEFINER so RLS isn't opened up. Returns active items with
-- their 86 status so the board can show "Sold out" and update as stock changes.
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
    where business_id = p_business_id and is_active = true;

  return jsonb_build_object('found', true, 'business_name', v_name, 'items', v_items);
end $$;
grant execute on function public.get_public_menu(uuid) to anon, authenticated;
