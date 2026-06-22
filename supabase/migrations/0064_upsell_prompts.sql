-- E6 suggestive-selling / combo prompts. When a trigger item (or any item in a
-- trigger category) is rung in, the register prompts to add a suggested item,
-- optionally at a combo discount ($ off the suggested item's price when added
-- together). Configured by owner/manager; resolved at ring-in.

create table if not exists public.upsell_prompts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  trigger_scope text not null default 'item',         -- item | category
  trigger_item_id uuid references public.catalog_items(id) on delete cascade,
  trigger_category text,
  suggest_item_id uuid not null references public.catalog_items(id) on delete cascade,
  label text,                                          -- prompt text, e.g. "Add fries?"
  combo_discount numeric not null default 0,           -- $ off the suggested item when added here
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists upsell_prompts_business_idx on public.upsell_prompts(business_id, active);

alter table public.upsell_prompts enable row level security;

drop policy if exists upsell_prompts_select on public.upsell_prompts;
create policy upsell_prompts_select on public.upsell_prompts for select
  using (exists (select 1 from public.business_members m where m.business_id = upsell_prompts.business_id and m.user_id = auth.uid()));
drop policy if exists upsell_prompts_write on public.upsell_prompts;
create policy upsell_prompts_write on public.upsell_prompts for all
  using (exists (select 1 from public.business_members m where m.business_id = upsell_prompts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = upsell_prompts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
