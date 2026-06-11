-- P0-2 Forced/required modifiers. Additive. Today modifiers are flat
-- (catalog_item_modifiers: name/price). This introduces modifier GROUPS with
-- required + min/max selection rules; the existing flat add-ons become members
-- of a non-required "Add-ons" group so every existing item behaves identically.

create table if not exists public.catalog_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  min_select int not null default 0,
  max_select int,                       -- null = unlimited
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cmg_business_idx on public.catalog_modifier_groups(business_id);
create index if not exists cmg_item_idx on public.catalog_modifier_groups(catalog_item_id);

alter table public.catalog_modifier_groups enable row level security;
drop policy if exists cmg_select on public.catalog_modifier_groups;
create policy cmg_select on public.catalog_modifier_groups for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cmg_insert on public.catalog_modifier_groups;
create policy cmg_insert on public.catalog_modifier_groups for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cmg_update on public.catalog_modifier_groups;
create policy cmg_update on public.catalog_modifier_groups for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists cmg_delete on public.catalog_modifier_groups;
create policy cmg_delete on public.catalog_modifier_groups for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

alter table public.catalog_item_modifiers
  add column if not exists group_id uuid references public.catalog_modifier_groups(id) on delete cascade,
  add column if not exists sort_order int not null default 0;

-- Backfill: one non-required "Add-ons" group per item that already has flat
-- modifiers, and point those modifiers at it. Existing menus are unchanged.
do $$
declare r record; gid uuid;
begin
  for r in select distinct business_id, catalog_item_id from public.catalog_item_modifiers where group_id is null loop
    insert into public.catalog_modifier_groups(business_id, catalog_item_id, name, required, min_select, max_select, sort_order)
    values (r.business_id, r.catalog_item_id, 'Add-ons', false, 0, null, 0)
    returning id into gid;
    update public.catalog_item_modifiers set group_id = gid where catalog_item_id = r.catalog_item_id and group_id is null;
  end loop;
end $$;
