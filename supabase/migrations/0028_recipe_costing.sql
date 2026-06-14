-- P3-36a Ingredient-level inventory + recipe costing (model + costing only).
-- Adds a layer BENEATH catalog items: raw ingredients with a per-unit cost, and
-- recipe_ingredients mapping each dish (catalog_items) to the ingredients +
-- quantities it consumes. Per-plate cost = sum(quantity * ingredient.cost);
-- margin = catalog_items.price - plate cost. Costs/quantities are numeric to
-- match catalog_items.price (dollars) so margin math stays in one unit.
-- Sale-time deduction into an ingredient ledger is P3-36b (separate diff).

-- Raw ingredients (e.g. "Ground beef", unit 'kg', cost 9.50/kg). Optional stock
-- tracking mirrors catalog_items (track + on-hand + reorder point) for P3-36b/38.
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  unit text not null default 'unit',          -- g | kg | ml | L | oz | each | unit ...
  cost numeric not null default 0,             -- cost per `unit`, in dollars
  track_stock boolean not null default false,
  stock_qty numeric not null default 0,        -- on-hand, in `unit`
  reorder_point numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists ingredients_business_idx on public.ingredients(business_id);
create unique index if not exists ingredients_business_name_idx
  on public.ingredients(business_id, lower(name));

-- A dish's recipe: one row per (dish, ingredient) with the quantity consumed per
-- single dish sold, expressed in that ingredient's unit. business_id denormalized
-- for simple membership RLS (mirrors other tables here).
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null default 0,         -- amount of ingredient per 1 dish, in ingredient.unit
  created_at timestamptz not null default now()
);
create unique index if not exists recipe_ingredients_dish_ingredient_idx
  on public.recipe_ingredients(catalog_item_id, ingredient_id);
create index if not exists recipe_ingredients_business_idx on public.recipe_ingredients(business_id);
create index if not exists recipe_ingredients_ingredient_idx on public.recipe_ingredients(ingredient_id);

-- RLS: membership-scoped, mirroring reservations/gift_cards/etc.
alter table public.ingredients enable row level security;
drop policy if exists ing_select on public.ingredients;
create policy ing_select on public.ingredients for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ing_insert on public.ingredients;
create policy ing_insert on public.ingredients for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ing_update on public.ingredients;
create policy ing_update on public.ingredients for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ing_delete on public.ingredients;
create policy ing_delete on public.ingredients for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

alter table public.recipe_ingredients enable row level security;
drop policy if exists ri_select on public.recipe_ingredients;
create policy ri_select on public.recipe_ingredients for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ri_insert on public.recipe_ingredients;
create policy ri_insert on public.recipe_ingredients for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ri_update on public.recipe_ingredients;
create policy ri_update on public.recipe_ingredients for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists ri_delete on public.recipe_ingredients;
create policy ri_delete on public.recipe_ingredients for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
