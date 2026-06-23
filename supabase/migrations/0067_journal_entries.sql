-- F8 general journal + recurring/auto-reversing templates (the backbone F11/F14/
-- F6 post into and F13/F9 read from). Double-entry: each entry has balanced lines
-- (sum debits = sum credits). entity tags an entry to a location/legal entity (F7).
-- reverses_id links an auto-reversing entry back to the one it reverses.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_date date not null,
  memo text,
  source text not null default 'manual',        -- manual | template | system | intercompany | deferred | breakage
  template_id uuid,
  reverses_id uuid references public.journal_entries(id) on delete set null,
  entity text,                                    -- F7: location / legal-entity tag
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists journal_entries_business_idx on public.journal_entries(business_id, entry_date desc);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_name text not null,
  account_code text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  memo text,
  sort integer not null default 0
);
create index if not exists journal_lines_entry_idx on public.journal_lines(entry_id);
create index if not exists journal_lines_business_idx on public.journal_lines(business_id);

create table if not exists public.journal_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  memo text,
  auto_reverse boolean not null default false,
  lines jsonb not null default '[]'::jsonb,       -- [{account_name, account_code, debit, credit, memo}]
  created_at timestamptz not null default now()
);
create index if not exists journal_templates_business_idx on public.journal_templates(business_id);

alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.journal_templates enable row level security;

-- Owner/manager only (the books).
do $$
declare t text;
begin
  for t in select unnest(array['journal_entries','journal_lines','journal_templates']) loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format($f$create policy %I_all on public.%I for all
      using (exists (select 1 from public.business_members m where m.business_id = %I.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))
      with check (exists (select 1 from public.business_members m where m.business_id = %I.business_id and m.user_id = auth.uid() and m.role in ('owner','manager')))$f$, t, t, t, t);
  end loop;
end $$;
