-- Surge HQ (operator control plane) HQ-0: platform-admin foundation.
-- This is a SEPARATE auth boundary from tenant users. platform_admins is keyed on
-- the auth user (NOT business_members), so no tenant user is ever a platform admin
-- by virtue of owning a business. Both tables are RLS deny-all — they are read
-- ONLY through the service-role client, and only after requirePlatformAdmin() has
-- verified the caller. Nothing here touches tenant tables, RLS, or behavior.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'readonly' check (role in ('owner','ops','support','readonly')),
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;  -- deny-all (no policy): service-role only

-- Operator activity log, isolated from the tenant audit_events so HQ actions never
-- leak into tenant-readable trails and global actions can have a null target.
create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  target_business_id uuid,            -- nullable: portfolio-wide actions have no single tenant
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_audit_events_created_idx on public.platform_audit_events(created_at desc);
create index if not exists platform_audit_events_target_idx on public.platform_audit_events(target_business_id, created_at desc);
alter table public.platform_audit_events enable row level security;  -- deny-all: service-role only

-- Seed the platform owner (you) by email — no hardcoded uuid.
insert into public.platform_admins (user_id, role)
select id, 'owner' from auth.users where lower(email) = 'aathis2006@gmail.com'
on conflict (user_id) do update set role = 'owner';
