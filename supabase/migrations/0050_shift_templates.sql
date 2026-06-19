-- P1.3 schedule depth: saveable shift templates. A template stores a week's
-- shifts as day-of-week + local times (items jsonb), applied to any future week.
create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.shift_templates enable row level security;
drop policy if exists shift_templates_select on public.shift_templates;
create policy shift_templates_select on public.shift_templates for select
  using (exists (select 1 from public.business_members m
    where m.business_id = shift_templates.business_id and m.user_id = auth.uid()));
drop policy if exists shift_templates_write on public.shift_templates;
create policy shift_templates_write on public.shift_templates for all
  using (exists (select 1 from public.business_members m
    where m.business_id = shift_templates.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m
    where m.business_id = shift_templates.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));
create index if not exists shift_templates_biz_idx on public.shift_templates(business_id);
