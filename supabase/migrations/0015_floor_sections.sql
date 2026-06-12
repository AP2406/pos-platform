-- P0-11 Server sections. Additive. Group tables into sections, give each a
-- color, and assign a server per section per shift. The live floor tints a
-- table by its section color. Full-service only (gated in app code).

create table if not exists public.floor_sections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid references public.floor_plans(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists floor_sections_business_idx on public.floor_sections(business_id);

alter table public.floor_elements
  add column if not exists section_id uuid references public.floor_sections(id) on delete set null;

create table if not exists public.section_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  section_id uuid not null references public.floor_sections(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  shift_date date not null default current_date,
  created_at timestamptz not null default now()
);
create unique index if not exists section_assignments_section_day_idx
  on public.section_assignments(section_id, shift_date);

-- RLS mirrors floor_plans (members of the owning business).
alter table public.floor_sections enable row level security;
drop policy if exists fs_select on public.floor_sections;
create policy fs_select on public.floor_sections for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists fs_insert on public.floor_sections;
create policy fs_insert on public.floor_sections for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists fs_update on public.floor_sections;
create policy fs_update on public.floor_sections for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists fs_delete on public.floor_sections;
create policy fs_delete on public.floor_sections for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

alter table public.section_assignments enable row level security;
drop policy if exists sa_select on public.section_assignments;
create policy sa_select on public.section_assignments for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists sa_insert on public.section_assignments;
create policy sa_insert on public.section_assignments for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists sa_update on public.section_assignments;
create policy sa_update on public.section_assignments for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists sa_delete on public.section_assignments;
create policy sa_delete on public.section_assignments for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
