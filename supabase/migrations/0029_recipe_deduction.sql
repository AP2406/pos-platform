-- P3-36b Sale-time ingredient deduction + ingredient stock ledger.
-- When a dish sells, deduct its recipe's ingredients from ingredient stock.
-- Implemented as an AFTER INSERT trigger on order_items (NOT by editing the big
-- create_pos_order RPC): order_items insert exactly once per sale (idempotent
-- replays return before the insert loop), so the trigger can't double-count.
-- Only ingredients with track_stock = true are decremented; deduction never
-- blocks a sale (ingredient stock is allowed to go negative — a bad count must
-- not stop the register). Training orders are skipped, matching item-level stock.

-- Ledger of every ingredient stock change (sale, receive, adjustment, count...).
create table if not exists public.ingredient_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  change numeric not null,                   -- signed: negative = consumed
  reason text not null default 'adjustment', -- sale | receive | adjustment | damage | initial | recount
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ingredient_movements_business_idx on public.ingredient_movements(business_id);
create index if not exists ingredient_movements_ingredient_idx on public.ingredient_movements(ingredient_id);
create index if not exists ingredient_movements_order_idx on public.ingredient_movements(order_id);

alter table public.ingredient_movements enable row level security;
drop policy if exists im_select on public.ingredient_movements;
create policy im_select on public.ingredient_movements for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists im_insert on public.ingredient_movements;
create policy im_insert on public.ingredient_movements for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Atomic manual stock change for one ingredient (receive / adjust / count).
-- Mirrors apply_inventory_change: row lock, write ledger, return new on-hand.
create or replace function public.apply_ingredient_change(
  p_business_id uuid,
  p_ingredient_id uuid,
  p_change numeric,
  p_reason text,
  p_note text default null,
  p_order_id uuid default null
) returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_new numeric;
begin
  if auth.uid() is not null and not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  update public.ingredients
    set stock_qty = stock_qty + p_change
    where id = p_ingredient_id and business_id = p_business_id
    returning stock_qty into v_new;

  if v_new is null then
    raise exception 'ingredient_not_found';
  end if;

  insert into public.ingredient_movements (business_id, ingredient_id, change, reason, order_id, note)
  values (p_business_id, p_ingredient_id, p_change,
          coalesce(nullif(p_reason,''),'adjustment'), p_order_id, p_note);

  return v_new;
end $$;

-- Deduct a sold dish's recipe ingredients. Fires per order_items row.
create or replace function public.deduct_recipe_ingredients()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_training boolean;
  v_line record;
  v_delta numeric;
begin
  if NEW.catalog_item_id is null or coalesce(NEW.quantity,0) = 0 then
    return NEW;
  end if;

  select coalesce(is_training,false) into v_training
    from public.orders where id = NEW.order_id;
  if coalesce(v_training,false) then
    return NEW;
  end if;

  for v_line in
    select ri.ingredient_id, ri.quantity
      from public.recipe_ingredients ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.catalog_item_id = NEW.catalog_item_id
        and ri.business_id = NEW.business_id
        and i.track_stock = true
  loop
    v_delta := -(v_line.quantity * NEW.quantity);
    update public.ingredients
      set stock_qty = stock_qty + v_delta
      where id = v_line.ingredient_id;
    insert into public.ingredient_movements (business_id, ingredient_id, change, reason, order_id)
    values (NEW.business_id, v_line.ingredient_id, v_delta, 'sale', NEW.order_id);
  end loop;

  return NEW;
end $$;

drop trigger if exists trg_deduct_recipe on public.order_items;
create trigger trg_deduct_recipe after insert on public.order_items
  for each row execute function public.deduct_recipe_ingredients();
