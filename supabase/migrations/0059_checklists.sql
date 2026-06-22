-- D6 open/close + changeover checklists. task_templates: the recurring items per
-- segment (manager-defined). task_instances: a per-day completion record with
-- sign-off (who + when). One completion per template per business day.

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null,
  segment text not null default 'open',       -- open | close | changeover
  assignee text,                               -- optional free-text "who" hint
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists task_templates_business_idx on public.task_templates(business_id, segment, sort);

create table if not exists public.task_instances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_id uuid not null references public.task_templates(id) on delete cascade,
  business_date date not null,
  completed_by_name text,
  completed_at timestamptz not null default now(),
  unique (template_id, business_date)
);
create index if not exists task_instances_business_date_idx on public.task_instances(business_id, business_date);

alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

-- Templates: members read; owner/manager write.
drop policy if exists task_templates_select on public.task_templates;
create policy task_templates_select on public.task_templates for select
  using (exists (select 1 from public.business_members m where m.business_id = task_templates.business_id and m.user_id = auth.uid()));
drop policy if exists task_templates_write on public.task_templates;
create policy task_templates_write on public.task_templates for all
  using (exists (select 1 from public.business_members m where m.business_id = task_templates.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = task_templates.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

-- Instances: any member (terminal session) can read / complete / clear.
drop policy if exists task_instances_all on public.task_instances;
create policy task_instances_all on public.task_instances for all
  using (exists (select 1 from public.business_members m where m.business_id = task_instances.business_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.business_members m where m.business_id = task_instances.business_id and m.user_id = auth.uid()));
