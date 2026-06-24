-- CUST-0 configuration foundation.
-- (1) orgs: a parent grouping over locations (each `businesses` row is a
--     location). Backfill creates one org per existing business so single-
--     location tenants get org==location automatically; CUST-6 groups several
--     locations under one org. (2) config_settings: the typed 4-level config
--     store resolved user → role → location → business(org) → system default.
-- Values are jsonb; money inside stays numeric dollars. Writes are audited +
-- permissioned in the server action; RLS here is the backstop.

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Organization',
  created_at timestamptz not null default now()
);

alter table public.businesses add column if not exists org_id uuid references public.orgs(id);

-- Backfill: one org per business that doesn't have one yet.
do $$
declare b record; v_org uuid;
begin
  for b in select id, name from public.businesses where org_id is null loop
    insert into public.orgs (name) values (coalesce(nullif(trim(b.name), ''), 'Organization')) returning id into v_org;
    update public.businesses set org_id = v_org where id = b.id;
  end loop;
end $$;

create table if not exists public.config_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  scope_type text not null,            -- business | location | role | user  (system lives in code)
  scope_id uuid not null,              -- org_id | businesses.id | roles.id | auth.users.id
  key text not null,
  value jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (scope_type, scope_id, key)
);
create index if not exists config_settings_org_key_idx on public.config_settings(org_id, key);

alter table public.orgs enable row level security;
alter table public.config_settings enable row level security;

-- orgs: members of any location in the org can read; owners may rename.
drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs for select
  using (id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid()));
drop policy if exists orgs_write on public.orgs;
create policy orgs_write on public.orgs for all
  using (id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid() and m.role in ('owner','manager')));

-- config_settings: any org member reads; user-scope rows are self-writable;
-- business/location/role scopes need owner/manager of the org (the server action
-- additionally enforces the manage_settings permission + demo lock + audit).
drop policy if exists config_settings_select on public.config_settings;
create policy config_settings_select on public.config_settings for select
  using (org_id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid()));
drop policy if exists config_settings_write on public.config_settings;
create policy config_settings_write on public.config_settings for all
  using (
    (scope_type = 'user' and scope_id = auth.uid())
    or org_id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid() and m.role in ('owner','manager'))
  )
  with check (
    (scope_type = 'user' and scope_id = auth.uid())
    or org_id in (select b.org_id from public.business_members m join public.businesses b on b.id = m.business_id where m.user_id = auth.uid() and m.role in ('owner','manager'))
  );

-- Seed the new manage_settings permission onto the Owner & Manager system roles
-- (code defaults already grant it via the legacy fallback matrix).
update public.roles
  set permissions = permissions || '["manage_settings"]'::jsonb
  where key in ('owner', 'manager') and not (permissions ? 'manage_settings');
