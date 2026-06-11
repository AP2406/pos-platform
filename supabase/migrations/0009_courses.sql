-- P0-1 Coursing. Additive. Courses are per-business, ordered, surfaced only in
-- the full-service POS (gated in app code). Coursing is kitchen routing/timing
-- only — it never touches order totals or the immutable snapshot.

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists courses_business_id_idx on public.courses(business_id);

alter table public.courses enable row level security;

-- RLS mirrors floor_plans / catalog_items: members of the owning business only.
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- Optional default course per menu item (null = falls back to the first course).
alter table public.catalog_items
  add column if not exists default_course_id uuid references public.courses(id) on delete set null;
