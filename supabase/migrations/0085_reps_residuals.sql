-- Surge HQ HQ-4: partner / rep management. Reps carry a commission config; merchants
-- attribute to a rep (businesses.rep_id, set on provisioning by referral code or
-- manually); payouts are logged. All three tables are RLS deny-all (HQ service-role
-- only). Nothing tenant-facing changes.

create table if not exists public.reps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  code text unique not null,                    -- the /apply/<code> attribution code
  status text not null default 'active' check (status in ('active','inactive')),
  residual_pct numeric not null default 0,      -- share of net processing revenue (e.g. 0.30)
  bounty numeric not null default 0,            -- one-time $ when a referred merchant goes live
  clawback_months integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.reps enable row level security;

alter table public.businesses add column if not exists rep_id uuid references public.reps(id) on delete set null;

create table if not exists public.rep_payouts (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.reps(id) on delete cascade,
  amount numeric not null,
  period text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists rep_payouts_rep_idx on public.rep_payouts(rep_id, created_at desc);
alter table public.rep_payouts enable row level security;
