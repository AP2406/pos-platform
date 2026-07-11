-- Multi-tax stacking: an item can have several named taxes (e.g. GST 5% + PST 7%).
-- Junction table is the source of truth; the legacy catalog_items.tax_rate_id is
-- kept only as a fallback for rows that never got a junction entry.
create table if not exists public.catalog_item_taxes (
  business_id uuid not null references public.businesses(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  tax_rate_id uuid not null references public.tax_rates(id) on delete cascade,
  primary key (catalog_item_id, tax_rate_id)
);
create index if not exists catalog_item_taxes_biz_idx on public.catalog_item_taxes(business_id, catalog_item_id);

alter table public.catalog_item_taxes enable row level security;
drop policy if exists catalog_item_taxes_select on public.catalog_item_taxes;
create policy catalog_item_taxes_select on public.catalog_item_taxes for select
  using (exists (select 1 from public.business_members m where m.business_id = catalog_item_taxes.business_id and m.user_id = auth.uid()));
drop policy if exists catalog_item_taxes_write on public.catalog_item_taxes;
create policy catalog_item_taxes_write on public.catalog_item_taxes for all
  using (exists (select 1 from public.business_members m where m.business_id = catalog_item_taxes.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = catalog_item_taxes.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

-- Backfill: every item that currently points at a single rate gets a junction row,
-- preserving today's behavior exactly.
insert into public.catalog_item_taxes (business_id, catalog_item_id, tax_rate_id)
select ci.business_id, ci.id, ci.tax_rate_id
  from public.catalog_items ci
 where ci.tax_rate_id is not null
on conflict do nothing;
