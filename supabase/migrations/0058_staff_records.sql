-- D5 + D7 staff-directed records.
-- staff_writeups: dated write-ups / commendations / coaching per employee —
-- sensitive HR records, owner/manager read+write only. staff_broadcasts +
-- broadcast_acks: manager announcements with per-staff acknowledgement.

create table if not exists public.staff_writeups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  type text not null default 'writeup',       -- writeup | commendation | coaching
  body text not null,
  occurred_on date not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists staff_writeups_business_idx on public.staff_writeups(business_id, created_at desc);
create index if not exists staff_writeups_staff_idx on public.staff_writeups(staff_id);

create table if not exists public.staff_broadcasts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists staff_broadcasts_business_idx on public.staff_broadcasts(business_id, created_at desc);

create table if not exists public.broadcast_acks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  broadcast_id uuid not null references public.staff_broadcasts(id) on delete cascade,
  staff_id uuid not null references public.staff_members(id) on delete cascade,
  staff_name text,
  acked_at timestamptz not null default now(),
  unique (broadcast_id, staff_id)
);
create index if not exists broadcast_acks_broadcast_idx on public.broadcast_acks(broadcast_id);

alter table public.staff_writeups enable row level security;
alter table public.staff_broadcasts enable row level security;
alter table public.broadcast_acks enable row level security;

-- Write-ups: owner/manager only (read + write) — HR-sensitive.
drop policy if exists writeups_all on public.staff_writeups;
create policy writeups_all on public.staff_writeups for all
  using (exists (select 1 from public.business_members m where m.business_id = staff_writeups.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = staff_writeups.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

-- Broadcasts: members read; owner/manager write.
drop policy if exists broadcasts_select on public.staff_broadcasts;
create policy broadcasts_select on public.staff_broadcasts for select
  using (exists (select 1 from public.business_members m where m.business_id = staff_broadcasts.business_id and m.user_id = auth.uid()));
drop policy if exists broadcasts_write on public.staff_broadcasts;
create policy broadcasts_write on public.staff_broadcasts for all
  using (exists (select 1 from public.business_members m where m.business_id = staff_broadcasts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
  with check (exists (select 1 from public.business_members m where m.business_id = staff_broadcasts.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')));

-- Acks: any member (the shared terminal session) can read + insert.
drop policy if exists acks_select on public.broadcast_acks;
create policy acks_select on public.broadcast_acks for select
  using (exists (select 1 from public.business_members m where m.business_id = broadcast_acks.business_id and m.user_id = auth.uid()));
drop policy if exists acks_insert on public.broadcast_acks;
create policy acks_insert on public.broadcast_acks for insert
  with check (exists (select 1 from public.business_members m where m.business_id = broadcast_acks.business_id and m.user_id = auth.uid()));
