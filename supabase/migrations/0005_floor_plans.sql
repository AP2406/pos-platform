-- Multiple floor plans (tabs) + chair-placement setting. Additive + idempotent.

-- 1) Floor plans (a business can have several: Main, Patio, Upstairs…) ---------
create table if not exists public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists floor_plans_business_idx on public.floor_plans(business_id);

alter table public.floor_plans enable row level security;
drop policy if exists floor_plans_select on public.floor_plans;
create policy floor_plans_select on public.floor_plans for select
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_plans_insert on public.floor_plans;
create policy floor_plans_insert on public.floor_plans for insert
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_plans_update on public.floor_plans;
create policy floor_plans_update on public.floor_plans for update
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()))
  with check (business_id in (select business_id from public.business_members where user_id = auth.uid()));
drop policy if exists floor_plans_delete on public.floor_plans;
create policy floor_plans_delete on public.floor_plans for delete
  using (business_id in (select business_id from public.business_members where user_id = auth.uid()));

-- 2) Bind every floor element to a plan ---------------------------------------
alter table public.floor_elements add column if not exists plan_id uuid references public.floor_plans(id) on delete cascade;

-- 3) Chair placement preference -----------------------------------------------
alter table public.businesses add column if not exists floor_chair_mode text not null default 'follow';

-- 4) Backfill: give each business with elements a "Main floor" and assign them -
do $$
declare b record; pid uuid;
begin
  for b in (select distinct business_id from public.floor_elements where plan_id is null) loop
    insert into public.floor_plans (business_id, name, sort_order)
      values (b.business_id, 'Main floor', 0)
      returning id into pid;
    update public.floor_elements set plan_id = pid
      where business_id = b.business_id and plan_id is null;
  end loop;
end $$;
