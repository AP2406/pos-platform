-- P3-38 variance report source. Per-ingredient theoretical (sales-driven) usage
-- vs logged waste over a period. SECURITY INVOKER so RLS on ingredient_movements
-- / waste_events scopes it to the caller's business (a foreign business_id just
-- returns no rows). Quantities are in each ingredient's unit.
create or replace function public.ingredient_usage_report(
  p_business_id uuid,
  p_since timestamptz
) returns table (ingredient_id uuid, sales_qty numeric, waste_qty numeric)
language sql
stable
set search_path to 'public'
as $$
  with sales as (
    select ingredient_id, -sum(change) as q
      from public.ingredient_movements
      where business_id = p_business_id and reason = 'sale' and created_at >= p_since
      group by ingredient_id
  ), waste as (
    select ingredient_id, sum(quantity) as q
      from public.waste_events
      where business_id = p_business_id and created_at >= p_since
      group by ingredient_id
  )
  select
    coalesce(s.ingredient_id, w.ingredient_id) as ingredient_id,
    coalesce(s.q, 0) as sales_qty,
    coalesce(w.q, 0) as waste_qty
  from sales s
  full outer join waste w on s.ingredient_id = w.ingredient_id;
$$;
