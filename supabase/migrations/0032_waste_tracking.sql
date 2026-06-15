-- P3-38 Waste tracking + theoretical-vs-actual variance.
-- waste_events is the categorized log of ingredient loss (spoilage, prep, spill,
-- expired, other). Logging waste decrements on-hand and writes a 'waste' row to
-- ingredient_movements (via apply_ingredient_change) so the stock ledger stays
-- whole. The variance report compares THEORETICAL usage (recipe deductions on
-- sale = 'sale' movements) against actual losses (waste_events) over a period.

create table if not exists public.waste_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null,                  -- amount wasted, in ingredient.unit (positive)
  reason text not null default 'other',       -- spoilage | prep | spill | expired | other
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists waste_events_business_idx on public.waste_events(business_id);
create index if not exists waste_events_ingredient_idx on public.waste_events(ingredient_id);
create index if not exists waste_events_created_idx on public.waste_events(business_id, created_at);

alter table public.waste_events enable row level security;
drop policy if exists waste_select on public.waste_events;
create policy waste_select on public.waste_events for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists waste_insert on public.waste_events;
create policy waste_insert on public.waste_events for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists waste_delete on public.waste_events;
create policy waste_delete on public.waste_events for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Log a waste event + decrement stock + write the ledger movement, atomically.
-- Returns the ingredient's new on-hand quantity.
create or replace function public.log_waste(
  p_business_id uuid,
  p_ingredient_id uuid,
  p_quantity numeric,
  p_reason text,
  p_note text default null
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
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if not exists (
    select 1 from public.ingredients where id = p_ingredient_id and business_id = p_business_id
  ) then
    raise exception 'ingredient_not_found';
  end if;

  insert into public.waste_events (business_id, ingredient_id, quantity, reason, note, created_by)
  values (p_business_id, p_ingredient_id, p_quantity,
          coalesce(nullif(p_reason,''),'other'), p_note, auth.uid());

  -- Reuse the audited stock primitive: negative change, reason 'waste'.
  v_new := public.apply_ingredient_change(p_business_id, p_ingredient_id, -p_quantity, 'waste', p_note, null);

  return v_new;
end $$;
